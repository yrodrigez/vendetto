import { GuildFeaturePolicyService } from "@/application/features/guild-feature-policy.service";
import { DiscordApiPort } from "@/application/ports/outbound/discord-api.port";
import { DiscordNicknameCandidateRepositoryPort } from "@/application/ports/outbound/database/discord-nickname-candidate-repository.port";

export class UpdateDiscordNicknamesToCharacterNamesUseCase {
    constructor(
        private readonly discordNicknameCandidateRepository: DiscordNicknameCandidateRepositoryPort,
        private readonly discordClient: DiscordApiPort,
        private readonly guildFeaturePolicyService: GuildFeaturePolicyService = new GuildFeaturePolicyService()
    ) { }

    async execute(guildId: string) {
        if (!this.guildFeaturePolicyService.isFeatureEnabled(guildId, 'updateNicknameToCharacterNickname')) {
            console.log('Feature "updateNicknameToCharacterNickname" is not enabled for this guild.');
            return;
        }
        const candidates = await this.discordNicknameCandidateRepository.findSelectedMembersWithDiscordAccount();
        for (const candidate of candidates) {
            try {
                const result = await this.discordClient.updateNickname(candidate.discordUserId, candidate.characterName, guildId);
                if (result) {
                    console.log(`Updated nickname for member ${result.memberId} to "${result.characterName}". Original nickname was "${result.originalNickname}".`);
                } else {
                    console.log(`No update performed for Discord user ID ${candidate.discordUserId}.`);
                }
            } catch (error) {
                console.error(`Failed to update nickname for Discord user ID ${candidate.discordUserId}:`, error);
            }
        }
    }
}