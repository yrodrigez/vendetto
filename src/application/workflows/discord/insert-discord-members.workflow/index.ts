import { WorkflowRepositoryPort } from "@/application/ports/outbound/database/workflow-scheduler-repository.port";
import { Schedule, Step, WorkflowName, WorkflowWithSchedule } from "../../workflow";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/database/workflow-run-repository.port";
import { InsertDiscordMembersUseCase } from "@/application/usecases/discord/insert-discord-membets.usecase";

@WorkflowName('insert-discord-members')
@Schedule('* */4 * * *', { isRunningOnStartup: false }) // Every 4 hours
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