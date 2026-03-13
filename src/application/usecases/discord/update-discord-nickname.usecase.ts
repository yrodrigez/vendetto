import { DiscordApiPort } from "@/application/ports/outbound/discord-api.port";

export class UpdateDiscordNicknameToCharacterNameUseCase {
    constructor(
        private readonly discord: DiscordApiPort,
    ) { }

    async execute(discordUserId: string, characterName: string, guildId: string) {
        try {
            const result = await this.discord.updateNickname(discordUserId, characterName, guildId);
            if (result) {
                console.log(`Updated nickname for member ${result.memberId} to "${result.characterName}". Original nickname was "${result.originalNickname}".`);
            }
        } catch (error) {
            console.error(`Failed to update nickname for Discord user ID ${discordUserId}:`, error);
        }
    }
}