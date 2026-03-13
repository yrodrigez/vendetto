import 'reflect-metadata'
import { WorkflowRunRepositoryPort, type WorkflowExecution } from "@/application/ports/outbound/workflow-run-repository.port";
import { WorkflowSchedulerRepositoryPort } from "@/application/ports/outbound/workflow-scheduler-repository.port";
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

export abstract class Workflow<TInput> {
    workflowId: string | null = null

    constructor(
        protected readonly workflowRepository: WorkflowRunRepositoryPort,
        protected input: TInput = {} as TInput
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
        if (this.workflowId) return this.workflowId
        throw new Error(`Workflow "${this.name}" has no workflowId. Use WorkflowWithSchedule or set workflowId manually.`)
    }

    async execute(params: TInput): Promise<void> {
        this.input = params
        const workflowId = await this.resolveWorkflowId()
        const execution = await this.workflowRepository.createExecution(workflowId, this.name)

        try {
            const steps = this.getSteps()
            await this.workflowRepository.updateExecution(execution.id, { status: 'running' })

            for (const step of steps) {
                await this.executeStep(execution, step)
            }

            await this.workflowRepository.updateExecution(execution.id, { status: 'completed' })
        } catch (error: any) {
            await this.workflowRepository.updateExecution(execution.id, {
                status: 'failed',
                error: error.message ?? String(error)
            })
            console.error(`Workflow "${this.name}" failed:`, error)
        }
    }

    protected async executeStep(execution: WorkflowExecution, step: StepMetadata): Promise<void> {
        const activity = await this.workflowRepository.createActivity(execution.id, step.name)
        await this.workflowRepository.updateExecution(execution.id, { currentStepId: activity.id })
        await this.workflowRepository.updateActivity(activity.id, { status: 'running' })

        try {
            await (this as any)[step.methodKey]()
            await this.workflowRepository.updateActivity(activity.id, { status: 'completed' })
            await this.workflowRepository.updateExecution(execution.id, { lastStepId: activity.id })
        } catch (error: any) {
            await this.workflowRepository.updateActivity(activity.id, {
                status: 'failed',
                error: error.message ?? String(error)
            })
            throw error
        }
    }
}

export abstract class WorkflowWithRetries<T> extends Workflow<T> {
    constructor(
        workflowRepository: WorkflowRunRepositoryPort,
        protected readonly schedulerRepository: WorkflowSchedulerRepositoryPort
    ) {
        super(workflowRepository)
    }

    private getRetryOptions(methodKey: string): RetryOptions | undefined {
        return Reflect.getOwnMetadata(RETRY_METADATA_KEY, this.constructor, methodKey)
    }

    protected async resolveWorkflowId(): Promise<string> {
        if (this.workflowId) return this.workflowId;

        // If a scheduler is provided, we use the workflow name as the permanent record
        if (this.schedulerRepository) {
            const existing = await this.schedulerRepository.findByNameAndContext(this.name);
            if (existing) {
                this.workflowId = existing.id;
                return existing.id;
            }

            // Create a new entry but with no running schedule
            const record = await this.schedulerRepository.upsert(this.name, '', 'stopped');
            this.workflowId = record.id;
            return record.id;
        }

        throw new Error("Unable to resolve workflow ID without a schedulerRepository.");
    }

    protected async executeStep(execution: WorkflowExecution, step: StepMetadata): Promise<void> {
        const retryOptions = this.getRetryOptions(step.methodKey)

        if (!retryOptions) {
            return super.executeStep(execution, step)
        }

        const { maxRetries, delayMs = 1000, backoff = 'fixed' } = retryOptions
        let lastError: any

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const activity = await this.workflowRepository.createActivity(
                execution.id,
                attempt === 0 ? step.name : `${step.name} (retry ${attempt}/${maxRetries})`
            )
            await this.workflowRepository.updateExecution(execution.id, { currentStepId: activity.id })
            await this.workflowRepository.updateActivity(activity.id, { status: 'running' })

            try {
                await (this as any)[step.methodKey]()
                await this.workflowRepository.updateActivity(activity.id, { status: 'completed' })
                await this.workflowRepository.updateExecution(execution.id, { lastStepId: activity.id })
                return
            } catch (error: any) {
                lastError = error
                await this.workflowRepository.updateActivity(activity.id, {
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

export abstract class WorkflowWithSchedule<T> extends WorkflowWithRetries<T> {
    readonly context?: string

    constructor(
        workflowRepository: WorkflowRunRepositoryPort,
        schedulerRepository: WorkflowSchedulerRepositoryPort,
        context?: string
    ) {
        super(workflowRepository, schedulerRepository)
        this.context = context
    }

    get schedule(): string {
        const cron = Reflect.getOwnMetadata(SCHEDULE_METADATA_KEY, this.constructor)
        if (!cron) {
            throw new Error(`Workflow class "${this.constructor.name}" is missing the @Schedule decorator`)
        }
        return cron
    }

    protected async resolveWorkflowId(): Promise<string> {
        if (this.workflowId) return this.workflowId
        const record = await this.schedulerRepository!.findByNameAndContext(this.name, this.context)
        if (!record) {
            throw new Error(`Workflow "${this.name}" (context: ${this.context ?? 'none'}) is not registered. Call register() first.`)
        }
        this.workflowId = record.id
        return record.id
    }

    async register(): Promise<void> {
        const existing = await this.schedulerRepository!.findByNameAndContext(this.name, this.context)
        if (existing) {
            this.workflowId = existing.id
            await this.schedulerRepository!.updateNextExecution(existing.id, this.computeNextExecution())
            await this.schedulerRepository!.upsert(this.name, this.schedule, 'running', this.context)
            console.log(`Workflow "${this.name}" (context: ${this.context ?? 'none'}) already registered (id: ${existing.id}, status: ${existing.status})`)
            return
        }

        const record = await this.schedulerRepository!.upsert(this.name, this.schedule, 'running', this.context)
        this.workflowId = record.id
        const nextExecution = this.computeNextExecution()
        await this.schedulerRepository!.updateNextExecution(record.id, nextExecution)
        console.log(`Workflow "${this.name}" (context: ${this.context ?? 'none'}) registered (id: ${record.id}), next execution: ${nextExecution.toISOString()}`)
    }

    async execute(params: T): Promise<void> {
        await super.execute(params)

        const id = await this.resolveWorkflowId()
        const nextExecution = this.computeNextExecution()
        await this.schedulerRepository!.updateNextExecution(id, nextExecution)
        console.log(`Workflow "${this.name}" next execution: ${nextExecution.toISOString()}`)
    }

    computeNextExecution(): Date {
        const interval = CronExpressionParser.parse(this.schedule, {
            tz: 'Europe/Madrid'
        })
        return interval.next().toDate()
    }
}
