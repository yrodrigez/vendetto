import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/database/workflow-run-repository.port";

export class WorkflowsCleanupUseCase {
    constructor(private workflowRunRepository: WorkflowRunRepositoryPort) { }

    async execute(daysAgo: number): Promise<void> {
        await this.workflowRunRepository.cleanup(daysAgo);
    }
}