import cron, { ScheduledTask } from 'node-cron'
import { WorkflowWithSchedule } from "@/application/workflows/workflow";
import { WorkflowSchedulerRepositoryPort } from "@/application/ports/outbound/workflow-scheduler-repository.port";

type RegisteredWorkflow = {
    workflow: WorkflowWithSchedule<any>
    defaultParams: any
    task: ScheduledTask
}

export class WorkflowSchedulerService {
    private readonly registry = new Map<string, RegisteredWorkflow>()

    constructor(private readonly schedulerRepository: WorkflowSchedulerRepositoryPort) {}

    async registerWorkflow<T>(workflow: WorkflowWithSchedule<T>, defaultParams: T): Promise<void> {
        await workflow.register()

        const task = cron.createTask(workflow.schedule, async () => {
            try {
                console.log(`Executing workflow "${workflow.name}" (${workflow.workflowId})`)
                await this.schedulerRepository.updateStatus(workflow.workflowId!, 'running')
                await workflow.execute(defaultParams)
                const nextExecution = workflow.computeNextExecution()
                await this.schedulerRepository.updateNextExecution(workflow.workflowId!, nextExecution)
            } catch (error) {
                console.error(`Scheduled workflow "${workflow.name}" (${workflow.workflowId}) failed:`, error)
            } finally {
                await this.schedulerRepository.updateStatus(workflow.workflowId!, 'stopped').catch(() => {})
            }
        }, { timezone: 'Europe/Madrid' })

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
