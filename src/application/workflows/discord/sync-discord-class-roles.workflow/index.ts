import { DiscordChannelLoggerPort } from "@/application/ports/outbound/discord-channel-logger.port";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/workflow-run-repository.port";
import { WorkflowRepositoryPort } from "@/application/ports/outbound/workflow-scheduler-repository.port";
import { FindCandidatesForClassRoleUseCase } from "@/application/usecases/discord/find-candidates-for-class-role.usecase";
import { InsertUsersInRoleUsecase } from "@/application/usecases/discord/insert-users-in-role.usecase";
import { RemoveUsersFromRoleUsecase } from "@/application/usecases/discord/remove-users-from-role.usecase";
import { Schedule, Step, WorkflowName, WorkflowWithSchedule } from "@/application/workflows/workflow";

@WorkflowName('sync-discord-class-roles')
@Schedule('0 0 * * *', { isRunningOnStartup: true })
export class SyncDiscordClassRolesWorkflow extends WorkflowWithSchedule<{ guildId: string }> {
    constructor(
        readonly workflowRepository: WorkflowRepositoryPort,
        readonly workflowRunRepository: WorkflowRunRepositoryPort,
        readonly guildId: string,
        private readonly findCandidatesForClassRoleUseCase: FindCandidatesForClassRoleUseCase,
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

    @Step('sync-warrior', 1)
    async syncWarrior() {
        await this.syncClassRole('warrior')
    }

    @Step('sync-shaman', 2)
    async syncShaman() {
        await this.syncClassRole('shaman')
    }

    @Step('sync-warlock', 3)
    async syncWarlock() {
        await this.syncClassRole('warlock')
    }

    @Step('sync-mage', 4)
    async syncMage() {
        await this.syncClassRole('mage')
    }

    @Step('sync-rogue', 5)
    async syncRogue() {
        await this.syncClassRole('rogue')
    }

    @Step('sync-hunter', 6)
    async syncHunter() {
        await this.syncClassRole('hunter')
    }

    @Step('sync-druid', 7)
    async syncDruid() {
        await this.syncClassRole('druid')
    }

    @Step('sync-paladin', 8)
    async syncPaladin() {
        await this.syncClassRole('paladin')
    }

    @Step('sync-priest', 9)
    async syncPriest() {
        await this.syncClassRole('priest')
    }

    private async syncClassRole(className: string) {
        const { insert, remove } = await this.findCandidatesForClassRoleUseCase.execute({ guildId: this.input.guildId, className })

        if (remove.length > 0) {
            console.log(`Removing role "${className}" from users:`, remove)
            try {
                await this.removeUsersFromRoleUsecase.execute(this.input.guildId, className, remove.map(c => c.discordUserId))
                console.log(`Successfully removed role "${className}" from users:`, remove)
            } catch (error: any) {
                console.error(`Failed to remove role "${className}" from users:`, remove, error)
                this.logger.log(this.input.guildId, `Failed to remove role "${className}" from users: ${remove.map(c => `${c.discordUserId} (${c.characterName})`).join(', ')}: ${error.message ?? String(error)}`)
            }
        } else {
            console.log(`No members to remove from role "${className}"`)
        }

        if (insert.length > 0) {
            console.log(`Inserting role "${className}" to users:`, insert)
            try {
                await this.insertUsersInRoleUsecase.execute(this.input.guildId, className, insert.map(c => c.discordUserId))
                console.log(`Successfully inserted role "${className}" to users:`, insert)
            } catch (error: any) {
                console.error(`Failed to insert role "${className}" to users:`, insert, error)
                this.logger.log(this.input.guildId, `Failed to insert role "${className}" to users: ${insert.map(c => `${c.discordUserId} (${c.characterName})`).join(', ')}: ${error.message ?? String(error)}`)
            }
        } else {
            console.log(`No members to insert into role "${className}"`)
        }
    }
}
