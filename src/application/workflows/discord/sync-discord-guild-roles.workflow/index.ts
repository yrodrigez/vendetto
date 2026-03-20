import { DiscordChannelLoggerPort } from "@/application/ports/outbound/discord-channel-logger.port";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/workflow-run-repository.port";
import { WorkflowRepositoryPort } from "@/application/ports/outbound/workflow-scheduler-repository.port";
import { FindMembersShouldBeInGuildRoleUsecase } from "@/application/usecases/discord/find-members-should-be-in-guild-role.usecase";
import { InsertUsersInRoleUsecase } from "@/application/usecases/discord/insert-users-in-role.usecase";
import { RemoveUsersFromRoleUsecase } from "@/application/usecases/discord/remove-users-from-role.usecase";
import { Schedule, Step, WorkflowName, WorkflowWithSchedule } from "@/application/workflows/workflow";

@WorkflowName('sync-discord-guild-roles')
@Schedule('*/240 * * * *', { isRunningOnStartup: true }) // Every 4 hours
export class SyncDiscordGuildRolesWorkflow extends WorkflowWithSchedule<{ guildId: string }> {
    private candidatesInsert: { discordUserId: string, characterName: string }[] = []
    private candidatesRemove: { discordUserId: string, characterName: string }[] = []
    private readonly discordRoleName = 'guildies'

    constructor(
        readonly workflowRepository: WorkflowRepositoryPort,
        readonly workflowRunRepository: WorkflowRunRepositoryPort,
        readonly guildId: string,
        private readonly findMembersShouldBeInGuildRoleUsecase: FindMembersShouldBeInGuildRoleUsecase,
        private readonly removeUsersFromRoleUsecase: RemoveUsersFromRoleUsecase,
        private readonly insertUsersInRoleUsecase: InsertUsersInRoleUsecase,
        private readonly logger: DiscordChannelLoggerPort,
    ) {
        super(workflowRepository, workflowRunRepository, guildId)
    }

    @Step('start-workflow', 0)
    async startWorkflow() {
        console.log(`Starting workflow "${this.name}" with input:`, this.input)
    }

    @Step('sync-members', 1)
    async syncMembers() {
        const { insert, remove } = await this.findMembersShouldBeInGuildRoleUsecase.execute({ guildId: this.input.guildId })

        this.candidatesInsert = insert
        this.candidatesRemove = remove

        console.log(`Members to insert into role:`, this.candidatesInsert)
        console.log(`Members to remove from role:`, this.candidatesRemove)
    }

    @Step('remove-members-from-role', 2)
    async removeMembersFromRole() {
        if (this.candidatesRemove.length === 0) {
            console.log(`No members to remove from role "${this.discordRoleName}"`)
            return;
        }
        console.log(`Removing role "${this.discordRoleName}" from users:`, this.candidatesRemove)
        try {
            await this.removeUsersFromRoleUsecase.execute(this.input.guildId, this.discordRoleName, this.candidatesRemove.map(candidate => candidate.discordUserId))
            console.log(`Successfully removed role "${this.discordRoleName}" from users:`, this.candidatesRemove)
        } catch (error: any) {
            console.error(`Failed to remove role "${this.discordRoleName}" from users:`, this.candidatesRemove, error)
            this.logger.log(this.input.guildId, `Failed to remove role "${this.discordRoleName}" from users: ${this.candidatesRemove.map(candidate => `${candidate.discordUserId} (${candidate.characterName})`).join(', ')}: ${error.message ?? String(error)}`)
        }
    }

    @Step('insert-members-in-role', 3)
    async insertMembersInRole() {
        if (this.candidatesInsert.length === 0) {
            console.log(`No members to insert into role "${this.discordRoleName}"`)
            return;
        }
        console.log(`Inserting role "${this.discordRoleName}" to users:`, this.candidatesInsert)
        try {
            await this.insertUsersInRoleUsecase.execute(this.input.guildId, this.discordRoleName, this.candidatesInsert.map(candidate => candidate.discordUserId))
            console.log(`Successfully inserted role "${this.discordRoleName}" to users:`, this.candidatesInsert)
        } catch (error: any) {
            console.error(`Failed to insert role "${this.discordRoleName}" to users:`, this.candidatesInsert, error)
            this.logger.log(this.input.guildId, `Failed to insert role "${this.discordRoleName}" to users: ${this.candidatesInsert.map(candidate => `${candidate.discordUserId} (${candidate.characterName})`).join(', ')}: ${error.message ?? String(error)}`)
        }
    }
}
