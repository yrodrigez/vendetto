import { GuildMember } from "discord.js";

export interface DiscordApiPort {
    updateNickname(discordUserId: string, nickname: string, guildId: string): Promise<{ memberId: string, characterName: string, originalNickname: string } | void>;
    getMember(discordUserId: string, guildId: string): Promise<GuildMember | null>;
    existsMember(discordUserId: string, guildId: string): Promise<boolean>;
    findMembersInRole(guildId: string, roleName: string): Promise<GuildMember[]>;
    findAllRoles(guildId: string): Promise<{ name: string, id: string }[]>;
    insertMembersInRole(guildId: string, roleName: string, memberIds: string[]): Promise<void>;
    removeMembersFromRole(guildId: string, roleName: string, memberIds: string[]): Promise<void>;
    findAllMembers(guildId: string): Promise<GuildMember[]>;
}