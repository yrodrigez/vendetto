import { WorkflowRepositoryPort } from "@/application/ports/outbound/workflow-scheduler-repository.port";
import { WorkflowWithSchedule } from "@/application/workflows/workflow";
import cron from 'node-cron';
import { DiscordChannelLoggerPort } from '../ports/outbound/discord-channel-logger.port';

type RegisteredWorkflow = {
    workflow: WorkflowWithSchedule<any>
    defaultParams: any
    task: WorkflowScheduledTask
}

const TIMEZONE = 'Europe/Madrid'

interface ScheduledWorkflowTriggerStrategy<T> {
    supports(workflow: WorkflowWithSchedule<T>): boolean
    execute(workflow: WorkflowWithSchedule<T>, params: T): Promise<WorkflowScheduledTask>
}

class WorkflowExecutor<T> {
    private readonly runningWorkflowIds = new Map<string, Promise<void>>()

    constructor(
        private readonly schedulerRepository: WorkflowRepositoryPort,
        private readonly logger: DiscordChannelLoggerPort
    ) { }


    async execute(workflow: WorkflowWithSchedule<T>, params: T): Promise<void> {
        const workflowId = workflow.workflowId!
        const previousRun = this.runningWorkflowIds.get(workflowId) ?? Promise.resolve()

        const runPromise = previousRun.catch(() => {
            // Previous run failed, but we want to continue with the next execution
        }).then(async () => {
            try {
                console.log(`Executing workflow "${workflow.name}" (${workflow.workflowId})`)
                await this.schedulerRepository.updateStatus(workflow.workflowId!, 'running')
                await workflow.execute(params)
            } catch (error: any) {
                console.error(`Workflow "${workflow.name}" (${workflow.workflowId}) execution failed:`, error)
                this.logger.log(workflow.context!, `Workflow "${workflow.name}" execution failed: ${error.message ?? String(error)}`)
            } finally {
                const nextExecution = workflow.computeNextExecution()
                await this.schedulerRepository.updateNextExecution(workflow.workflowId!, nextExecution)
                await this.schedulerRepository.updateStatus(workflow.workflowId!, 'scheduled').catch(() => { })
            }
        })

        this.runningWorkflowIds.set(workflowId, runPromise)
        try {
            await runPromise
        } finally {
            if (this.runningWorkflowIds.get(workflowId) === runPromise) {
                this.runningWorkflowIds.delete(workflowId)
            }
        }
    }
}

abstract class ScheduledWorkflowTriggerStrategyBase<T> implements ScheduledWorkflowTriggerStrategy<T> {
    abstract supports(workflow: WorkflowWithSchedule<T>): boolean
    abstract execute(workflow: WorkflowWithSchedule<T>, params: T): Promise<WorkflowScheduledTask>
    constructor(
        protected readonly schedulerRepository: WorkflowRepositoryPort,
        protected readonly logger: DiscordChannelLoggerPort,
        protected readonly executor: WorkflowExecutor<T> = new WorkflowExecutor(schedulerRepository, logger)
    ) { }
}

interface WorkflowScheduledTask {
    start(): void | Promise<void>
    stop(): void | Promise<void>
}

class WorkflowTaskBuilder {
    buildTask(schedule: string, fn: () => Promise<any>, options: { endDate?: Date, maxExecutions?: number, timezone?: string } = { timezone: TIMEZONE }): WorkflowScheduledTask {
        const task = cron.createTask(schedule, async () => {
            if (options.endDate && new Date() > options.endDate) {
                console.log(`Workflow has reached its end date. Stopping scheduled execution.`)
                task.stop()
                return
            }
            await fn()
        }, { timezone: options.timezone, maxExecutions: options.maxExecutions })

        return task
    }
}


class ScheduleTriggerStrategy<T> extends ScheduledWorkflowTriggerStrategyBase<T> implements ScheduledWorkflowTriggerStrategy<T> {

    constructor(
        schedulerRepository: WorkflowRepositoryPort,
        logger: DiscordChannelLoggerPort,
    ) {
        super(schedulerRepository, logger)
    }

    supports(workflow: WorkflowWithSchedule<T>): boolean {
        return !!workflow.schedule && workflow.options.isRecurring === false && workflow.options.isRunningOnStartup === false
    }

    async execute(workflow: WorkflowWithSchedule<T>, params: T): Promise<WorkflowScheduledTask> {
        const taskOptions = {
            timezone: TIMEZONE,
            maxExecutions: 1,
            endDate: workflow.options.endDate
        }

        const builder = new WorkflowTaskBuilder()

        return builder
            .buildTask(
                workflow.schedule!, () => this.executor.execute(workflow, params), taskOptions)
    }
}

class ScheduleRecurringStrategy<T> extends ScheduledWorkflowTriggerStrategyBase<T> implements ScheduledWorkflowTriggerStrategy<T> {

    constructor(
        schedulerRepository: WorkflowRepositoryPort,
        logger: DiscordChannelLoggerPort
    ) {
        super(schedulerRepository, logger)
    }

    supports(workflow: WorkflowWithSchedule<T>): boolean {
        return !!workflow.schedule && workflow.options.isRecurring === true
    }

    async execute(workflow: WorkflowWithSchedule<T>, params: T): Promise<WorkflowScheduledTask> {

        const taskOptions = {
            timezone: TIMEZONE,
            endDate: workflow.options.endDate
        }

        const isRunningOnStartup = workflow.options.isRunningOnStartup ?? false
        if (isRunningOnStartup) {
            if (workflow.options.endDate && new Date() > workflow.options.endDate) {
                console.log(`Workflow "${workflow.name}" has an end date in the past. Skipping immediate execution.`)
            } else {
                console.log(`Workflow "${workflow.name}" is configured to run on startup. Executing immediately.`)
                await this.executor.execute(workflow, params)
            }
        }

        const builder = new WorkflowTaskBuilder()
        const task = builder.buildTask(workflow.schedule!, () => this.executor.execute(workflow, params), taskOptions)

        return task
    }
}


export class WorkflowSchedulerService {
    private readonly registry = new Map<string, RegisteredWorkflow>()
    private readonly triggerStrategies: ScheduledWorkflowTriggerStrategy<any>[] = [
        new ScheduleTriggerStrategy(this.schedulerRepository, this.logger),
        new ScheduleRecurringStrategy(this.schedulerRepository, this.logger)
    ]

    constructor(
        private readonly schedulerRepository: WorkflowRepositoryPort,
        private readonly logger: DiscordChannelLoggerPort
    ) { }

    async registerWorkflow<T>(workflow: WorkflowWithSchedule<T>, defaultParams: T): Promise<void> {
        await workflow.register()
        if (!workflow.schedule) {
            console.warn(`Workflow "${workflow.name}" does not have a schedule. Skipping registration in WorkflowScheduler.`)
            return
        }

        if (this.registry.has(workflow.workflowId!)) {
            console.warn(`Workflow "${workflow.name}" (${workflow.workflowId}) is already registered. Skipping duplicate registration.`)
            return
        }

        const strategy = this.triggerStrategies.find(s => s.supports(workflow))
        if (!strategy) {
            throw new Error(`No trigger strategy found for workflow "${workflow.name}" with schedule "${workflow.schedule}" and options ${JSON.stringify(workflow.options)}`)
        }

        const task = await strategy.execute(workflow, defaultParams)

        this.registry.set(workflow.workflowId!, { workflow, defaultParams, task })
    }

    start(): void {
        for (const [id, entry] of this.registry) {
            entry.task.start()
            console.log(`Workflow "${entry.workflow.name}" (${id}) cron started: ${entry.workflow.schedule}`)
        }
        console.log(`WorkflowScheduler started (${this.registry.size} workflows)`)
    }

    stop(): void {
        for (const [id, entry] of this.registry) {
            entry.task.stop()
            console.log(`Workflow "${entry.workflow.name}" (${id}) cron stopped`)
        }
        console.log('WorkflowScheduler stopped')
    }
}
