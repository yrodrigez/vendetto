import { WorkflowsCleanupUseCase } from "@/application/usecases/cleanup/workflows-cleanup.usecase";
import { Retryable, Schedule, Step, WorkflowName, WorkflowWithSchedule } from "../workflow";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/database/workflow-run-repository.port";
import { WorkflowRepositoryPort } from "@/application/ports/outbound/database/workflow-scheduler-repository.port";

@WorkflowName('Cleanup Workflow Executions and Activities')
@Schedule('0 0 * * *', { isRecurring: true, isRunningOnStartup: true }) // runs every day at midnight
export class CleanupWorkflowsExecutionActivitiesWorkflow extends WorkflowWithSchedule<void> {
    private static readonly activitiesDaysAgo = 15; // delete activities older than 15 days

    constructor(
        private workflowsCleanupUseCase: WorkflowsCleanupUseCase,
        workflowExecutionRepository: WorkflowRunRepositoryPort,
        workflowRepository: WorkflowRepositoryPort,
        context: string
    ) {
        super(workflowRepository, workflowExecutionRepository, context)
    }

    @Step('cleanup-workflow-activities-and-executions', 0)
    @Retryable({ maxRetries: 3, delayMs: 1000 })
    async performCleanup(): Promise<void> {
        console.log(`Starting cleanup of workflow executions and activities older than ${CleanupWorkflowsExecutionActivitiesWorkflow.activitiesDaysAgo} days.`);
        await this.workflowsCleanupUseCase.execute(CleanupWorkflowsExecutionActivitiesWorkflow.activitiesDaysAgo);
        console.log(`Finished cleanup of workflow executions and activities.`);
    }
}
