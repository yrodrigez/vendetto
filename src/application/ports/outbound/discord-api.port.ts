import { GuildMember } from "discord.js";

export interface DiscordApiPort {
    updateNickname(discordUserId: string, nickname: string, guildId: string): Promise<{ memberId: string, characterName: string, originalNickname: string } | void>;
    getMember(discordUserId: string, guildId: string): Promise<GuildMember | null>;
    existsMember(discordUserId: string, guildId: string): Promise<boolean>;
}