import 'reflect-metadata'
import { WorkflowRunRepositoryPort as WorkflowExecutionRepositoryPort, type WorkflowExecution } from "@/application/ports/outbound/workflow-run-repository.port";
import { WorkflowRepositoryPort } from "@/application/ports/outbound/workflow-scheduler-repository.port";
import { CronExpressionParser } from 'cron-parser'

const STEPS_METADATA_KEY = Symbol('workflow:steps')
const NAME_METADATA_KEY = Symbol('workflow:name')
const RETRY_METADATA_KEY = Symbol('workflow:retry')
const SCHEDULE_METADATA_KEY = Symbol('workflow:schedule')

type StepMetadata = {
    name: string
    methodKey: string
    order: number
}

export type RetryOptions = {
    maxRetries: number
    delayMs?: number
    backoff?: 'fixed' | 'exponential'
}

export type ScheduledWorkflowOptions = {
    isRunningOnStartup?: boolean,
    isRecurring?: boolean,
    endDate?: Date
}


export function WorkflowName(name: string): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(NAME_METADATA_KEY, name, target)
    }
}

export function Step(name: string, order?: number): MethodDecorator {
    return (target, propertyKey) => {
        const steps: StepMetadata[] = Reflect.getOwnMetadata(STEPS_METADATA_KEY, target.constructor) ?? []
        steps.push({
            name,
            methodKey: String(propertyKey),
            order: order ?? steps.length
        })
        Reflect.defineMetadata(STEPS_METADATA_KEY, steps, target.constructor)
    }
}

export function Schedule(cron: string): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(SCHEDULE_METADATA_KEY, cron, target)
    }
}

export function Retryable(options: RetryOptions = { maxRetries: 3, delayMs: 1000, backoff: 'fixed' }): MethodDecorator {
    return (target, propertyKey) => {
        Reflect.defineMetadata(RETRY_METADATA_KEY, options, target.constructor, propertyKey)
    }
}

export abstract class Workflow<TInput, TOutput = void> {
    workflowId: string | null = null
    protected currentStepId: string | null = null
    protected lastStepId: string | null = null
    protected executionId: number | null = null


    constructor(
        protected readonly workflowRepository: WorkflowRepositoryPort,
        protected readonly workflowExecutionRepository: WorkflowExecutionRepositoryPort,
        protected input: TInput = {} as TInput,
        protected readonly context: string
    ) { }

    get name(): string {
        const name = Reflect.getOwnMetadata(NAME_METADATA_KEY, this.constructor)
        if (!name) {
            throw new Error(`Workflow class "${this.constructor.name}" is missing the @WorkflowName decorator`)
        }
        return name
    }

    private getSteps(): StepMetadata[] {
        const steps: StepMetadata[] = Reflect.getOwnMetadata(STEPS_METADATA_KEY, this.constructor) ?? []
        return steps.sort((a, b) => a.order - b.order)
    }

    protected async resolveWorkflowId(): Promise<string> {
        if (this.workflowId) return this.workflowId;

        const existing = await this.workflowRepository.findByNameAndContext(this.name, this.context);
        if (existing) {
            this.workflowId = existing.id;
            return existing.id;
        }

        // Create a new entry but with no running schedule
        const record = await this.workflowRepository.upsert(this.name, '', 'stopped');
        this.workflowId = record.id;
        return record.id;
    }

    protected async stop(): Promise<void> {
        if (!this.workflowId) {
            throw new Error(`Cannot stop workflow "${this.name}" because it has no workflowId.`)
        }

        await this.workflowRepository.updateStatus(this.workflowId, 'stopped')
        if (this.executionId) {
            await this.workflowExecutionRepository.updateExecution(this.executionId, { status: 'stopped' })
        }

    }

    async execute(input: TInput): Promise<TOutput> {
        this.input = input
        const workflowId = await this.resolveWorkflowId()
        const execution = await this.workflowExecutionRepository.createExecution(workflowId, this.name)
        this.executionId = execution.id
        this.currentStepId = null
        this.lastStepId = null
        let output: TOutput | void = undefined
        try {
            const steps = this.getSteps()
            await this.workflowExecutionRepository.updateExecution(execution.id, { status: 'running' })

            for (const step of steps) {
                output = await this.executeStep(execution, step)
            }

            await this.workflowExecutionRepository.updateExecution(execution.id, { status: 'completed' })
            return output as TOutput
        } catch (error: any) {
            await this.workflowExecutionRepository.updateExecution(execution.id, {
                status: 'failed',
                error: error.message ?? String(error)
            })
            throw error
        }
    }

    protected async executeStep(execution: WorkflowExecution, step: StepMetadata): Promise<TOutput | void> {
        const activity = await this.workflowExecutionRepository.createActivity(execution.id, step.name)
        await this.workflowExecutionRepository.updateExecution(execution.id, { currentStepId: activity.id })
        await this.workflowExecutionRepository.updateActivity(activity.id, { status: 'running' })
        this.currentStepId = activity.id

        try {
            const result = await (this as any)[step.methodKey]()
            await this.workflowExecutionRepository.updateActivity(activity.id, { status: 'completed' })
            await this.workflowExecutionRepository.updateExecution(execution.id, { lastStepId: activity.id })
            this.lastStepId = activity.id;
            return result
        } catch (error: any) {
            await this.workflowExecutionRepository.updateActivity(activity.id, {
                status: 'failed',
                error: error.message ?? String(error)
            })
            throw error
        }
    }
}

export abstract class WorkflowWithRetries<T, TOutput = void> extends Workflow<T, TOutput> {
    constructor(
        protected readonly workflowRepository: WorkflowRepositoryPort,
        protected readonly workflowExecutionRepository: WorkflowExecutionRepositoryPort,
        protected readonly context: string
    ) {
        super(workflowRepository, workflowExecutionRepository, {} as T, context)
    }

    private getRetryOptions(methodKey: string): RetryOptions | undefined {
        return Reflect.getOwnMetadata(RETRY_METADATA_KEY, this.constructor, methodKey)
    }

    protected async executeStep(execution: WorkflowExecution, step: StepMetadata): Promise<TOutput | void> {
        const retryOptions = this.getRetryOptions(step.methodKey)

        if (!retryOptions) {
            return super.executeStep(execution, step)
        }

        const { maxRetries, delayMs = 1000, backoff = 'fixed' } = retryOptions
        let lastError: any

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const activity = await this.workflowExecutionRepository.createActivity(
                execution.id,
                attempt === 0 ? step.name : `${step.name} (retry ${attempt}/${maxRetries})`
            )
            await this.workflowExecutionRepository.updateExecution(execution.id, { currentStepId: activity.id })
            await this.workflowExecutionRepository.updateActivity(activity.id, { status: 'running' })

            try {
                const result = await (this as any)[step.methodKey]()
                await this.workflowExecutionRepository.updateActivity(activity.id, { status: 'completed' })
                await this.workflowExecutionRepository.updateExecution(execution.id, { lastStepId: activity.id })
                return result
            } catch (error: any) {
                lastError = error
                await this.workflowExecutionRepository.updateActivity(activity.id, {
                    status: 'failed',
                    error: error.message ?? String(error)
                })

                if (attempt < maxRetries) {
                    const wait = backoff === 'exponential' ? delayMs * Math.pow(2, attempt) : delayMs
                    console.warn(`Step "${step.name}" failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${wait}ms...`)
                    await new Promise(resolve => setTimeout(resolve, wait))
                }
            }
        }

        throw lastError
    }
}

export abstract class WorkflowWithSchedule<T, TOutput = void> extends WorkflowWithRetries<T, TOutput> {

    constructor(
        readonly workflowRepository: WorkflowRepositoryPort,
        readonly workflowExecutionRepository: WorkflowExecutionRepositoryPort,
        readonly context: string,
        readonly options: ScheduledWorkflowOptions = { isRunningOnStartup: false, isRecurring: true, endDate: undefined }
    ) {
        super(workflowRepository, workflowExecutionRepository, context)
    }

    get schedule(): string {
        const cron = Reflect.getOwnMetadata(SCHEDULE_METADATA_KEY, this.constructor)
        if (!cron) {
            throw new Error(`Workflow class "${this.constructor.name}" is missing the @Schedule decorator`)
        }
        return cron
    }

    async register(): Promise<void> {
        const existing = await this.workflowRepository.findByNameAndContext(this.name, this.context)
        if (existing) {
            this.workflowId = existing.id
            await this.workflowRepository.updateNextExecution(existing.id, this.computeNextExecution())

            await this.workflowRepository.upsert(this.name, this.schedule, 'scheduled', this.context)
            console.log(`Workflow "${this.name}" (context: ${this.context}) already registered (id: ${existing.id}, status: ${existing.status})`)
            return
        }

        const record = await this.workflowRepository.upsert(this.name, this.schedule, 'running', this.context)
        this.workflowId = record.id
        const nextExecution = this.computeNextExecution()
        await this.workflowRepository.updateNextExecution(record.id, nextExecution)
        console.log(`Workflow "${this.name}" (context: ${this.context}) registered (id: ${record.id}), next execution: ${nextExecution.toISOString()}`)
    }

    computeNextExecution(): Date {
        const interval = CronExpressionParser.parse(this.schedule, {
            tz: 'Europe/Madrid'
        })
        return interval.next().toDate()
    }
}
