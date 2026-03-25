import { Step, WorkflowName, Schedule, WorkflowWithSchedule, Retryable } from "@/application/workflows/workflow";
import { DiscordNicknameCandidateRepositoryPort } from "@/application/ports/outbound/database/discord-nickname-candidate-repository.port";
import { DiscordApiPort } from "@/application/ports/outbound/discord-api.port";
import { GuildFeaturePolicyService } from "@/application/features/guild-feature-policy.service";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/database/workflow-run-repository.port";
import { WorkflowRepositoryPort } from "@/application/ports/outbound/database/workflow-scheduler-repository.port";
import { DiscordNicknameCandidate } from "@/application/dto/discord-nickname-candidate.dto";
import { DiscordChannelLoggerPort } from "@/application/ports/outbound/discord-channel-logger.port";

@WorkflowName('sync-discord-nicknames-on-login')
@Schedule('*/15 17-23 * * *', { isRunningOnStartup: false }) // Every 15 minutes between 17:00 and 23:59
export class SyncDiscordNicknamesWorkflow extends WorkflowWithSchedule<{ guildId: string }> {
    private candidates: DiscordNicknameCandidate[] = []

    constructor(
        private readonly candidateRepository: DiscordNicknameCandidateRepositoryPort,
        private readonly discordApi: DiscordApiPort,
        readonly workflowRunRepository: WorkflowRunRepositoryPort,
        readonly workflowRepository: WorkflowRepositoryPort,
        context: string,
        private readonly logger: DiscordChannelLoggerPort,
        private readonly featurePolicy: GuildFeaturePolicyService = new GuildFeaturePolicyService()
    ) {
        super(workflowRepository, workflowRunRepository, context)
    }

    @Step('start-workflow', 0)
    async startWorkflow() {
        console.log(`Starting workflow "${this.name}" with input:`, this.input)
    }

    @Step('check-feature-enabled', 1)
    @Retryable()
    async checkFeatureEnabled() {
        if (!this.featurePolicy.isFeatureEnabled(this.input.guildId, 'updateNicknameToCharacterNickname')) {
            throw new Error(`Feature "updateNicknameToCharacterNickname" is not enabled for guild ${this.input.guildId}`)
        }
    }

    @Step('fetch-candidates', 2)
    @Retryable()
    async fetchCandidates() {
        this.candidates = await this.candidateRepository.findSelectedMembersWithDiscordAccount()
        console.log(`Found ${this.candidates.length} nickname candidates`)
    }

    @Step('update-nicknames', 3)
    @Retryable()
    async updateNicknames() {
        const allMemebers = await this.discordApi.findAllMembers(this.input.guildId)
        await Promise.all(this.candidates.map(async candidate => {
            try {
                if (candidate.discordUserId === '600220534885711893') {
                    console.log(`Skipping nickname update for user ${candidate.discordUserId} (excluded user)`)
                    return;
                }

                const member = allMemebers.find(m => m.id === candidate.discordUserId);
                if (!member) {
                    console.log(`Discord user ${candidate.discordUserId} not found in guild ${this.input.guildId}. Skipping nickname update.`)
                    return;
                }

                if (member.nickname === candidate.characterName || member.user.username === candidate.characterName) {
                    console.log(`Nickname for Discord user ${candidate.discordUserId} is already up to date. Skipping.`)
                    return;
                }
                console.log(`Updating nickname for Discord user ${candidate.discordUserId} to "${candidate.characterName}" in guild ${this.input.guildId}`)
                const result = await this.discordApi.updateNickname(
                    candidate.discordUserId,
                    candidate.characterName,
                    this.input.guildId
                )
                if (result) {
                    console.log(`Updated nickname for ${result.memberId} to "${result.characterName}" (was "${result.originalNickname}")`)
                    this.logger.log(this.input.guildId, `Updated nickname for ${result.memberId} to "${result.characterName}" (was "${result.originalNickname}")`)
                }
            } catch (error: any) {
                console.error(`Failed to update nickname for ${candidate.discordUserId}:`, error)
                this.logger.log(this.input.guildId, `Failed to update nickname for ${candidate.discordUserId}: ${error.message ?? String(error)}`)
                return; // Stop processing further candidates on error to avoid hitting rate limits or causing multiple failures in a single run
            }
        }))
    }
}
