import { WorkflowRepositoryPort } from "@/application/ports/outbound/workflow-scheduler-repository.port";
import { Schedule, Step, WorkflowName, WorkflowWithSchedule } from "../../workflow";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/workflow-run-repository.port";
import { InsertDiscordMembersUseCase } from "@/application/usecases/discord/insert-discord-membets.usecase";

@WorkflowName('insert-discord-members')
@Schedule('0 13 * * *', { isRunningOnStartup: true }) // Every day at 1 PM
export class InsertDiscordMembersWorkflow extends WorkflowWithSchedule<{ guildId: string }> {
    constructor(
        readonly workflowRepository: WorkflowRepositoryPort,
        readonly workflowRunRepository: WorkflowRunRepositoryPort,
        readonly guildId: string,
        private readonly insertDiscordMembersUseCase: InsertDiscordMembersUseCase,
    ) {
        super(workflowRepository, workflowRunRepository, guildId)
    }

    @Step('start-workflow', 0)
    async startWorkflow() {
        console.log(`Starting workflow "${this.name}" with input:`, this.input)
    }

    @Step('insert-discord-members', 1)
    async insertDiscordMembers() {
        await this.insertDiscordMembersUseCase.execute({ guildId: this.input.guildId })
    }

}