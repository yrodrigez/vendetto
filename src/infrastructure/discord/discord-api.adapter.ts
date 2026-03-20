import { DiscordApiPort } from "@/application/ports/outbound/discord-api.port";
import { Client, Collection, GatewayIntentBits, GuildMember, OAuth2Guild, Guild } from 'discord.js';
import { getEnvironment } from "../../infrastructure/environment";
import threadPool from "../../util/thread-pool";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
    ]
});
let loginPromise: Promise<string> | null = null;

export const getDiscordClient = async (): Promise<Client> => {
    if (client.isReady()) {
        return client;
    }
    if (!loginPromise) {
        const { discordToken } = getEnvironment();
        loginPromise = client.login(discordToken);
    }
    await loginPromise;
    return client;
}

export async function ensureClientReady() {
    await getDiscordClient();
    console.log('Discord client is ready');
}

const guildsCache: Map<string, Guild> = new Map();
const membersCache: Map<string, { members: Collection<string, GuildMember>, fetchedAt: number }> = new Map();
const MEMBERS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getGuilds(): Promise<Collection<string, OAuth2Guild>> {
    const client = await getDiscordClient();
    return client.guilds.fetch();
}

export class DiscordApiAdapter implements DiscordApiPort {

    private async getGuild(guildId: string) {
        if (guildsCache.has(guildId)) {
            return guildsCache.get(guildId);
        }
        const client = await getDiscordClient();
        const guild = await client.guilds.fetch(guildId);
        guildsCache.set(guildId, guild);
        return guild;
    }


    async findAllMembers(guildId: string): Promise<GuildMember[]> {
        return threadPool.submit(async () => {
            const guild = await this.getGuild(guildId);
            if (!guild) {
                throw new Error(`Guild with ID ${guildId} not found`);
            }
            const members = guild.members.cache;
            return members.map(member => member);
        });
    }

    async insertMembersInRole(guildId: string, roleId: string, memberIds: string[]): Promise<void> {
        await threadPool.submit(async () => {
            const guild = await this.getGuild(guildId);
            if (!guild) {
                throw new Error(`Guild with ID ${guildId} not found`);
            }
            const role = await guild.roles.fetch(roleId);
            if (!role) {
                throw new Error(`Role with ID ${roleId} not found in guild ${guildId}`);
            }
            for (const memberId of memberIds) {
                try {
                    const member = await guild.members.fetch(memberId);
                    if (!member) {
                        throw new Error(`Member with ID ${memberId} not found in guild ${guildId}`);
                    }
                    await member.roles.add(role);
                } catch (error: any) {
                    console.error(`Failed to add role ${role.name} to member ${memberId} in guild ${guildId}:`);
                    const errorCode = error.code || (typeof error === 'object' && 'code' in error ? error.code : null) || error.rawError?.code || (typeof error === 'object' && 'rawError' in error && error.rawError && 'code' in error.rawError ? error.rawError.code : null);
                    if (errorCode === 10007) { // Unknown Member
                        console.warn(`Member with ID ${memberId} not found in guild ${guildId}. Skipping role assignment.`);
                    } else {
                        throw error;
                    }
                }
            }
        });
    }

    async removeMembersFromRole(guildId: string, roleId: string, memberIds: string[]): Promise<void> {
        await threadPool.submit(async () => {
            const guild = await this.getGuild(guildId);
            if (!guild) {
                throw new Error(`Guild with ID ${guildId} not found`);
            }
            const role = await guild.roles.fetch(roleId);
            if (!role) {
                throw new Error(`Role with ID ${roleId} not found in guild ${guildId}`);
            }
            for (const memberId of memberIds) {
                try {
                    const member = await guild.members.fetch(memberId);
                    if (!member) {
                        throw new Error(`Member with ID ${memberId} not found in guild ${guildId}`);
                    }
                    await member.roles.remove(role);
                } catch (error: any) {
                    console.error(`Failed to remove role ${role.name} from member ${memberId} in guild ${guildId}:`);
                    const errorCode = error.code || (typeof error === 'object' && 'code' in error ? error.code : null) || error.rawError?.code || (typeof error === 'object' && 'rawError' in error && error.rawError && 'code' in error.rawError ? error.rawError.code : null);
                    if (errorCode === 10007) { // Unknown Member
                        console.warn(`Member with ID ${memberId} not found in guild ${guildId}. Skipping role removal.`);
                    } else {
                        console.error(`Error details:`, error);
                        throw error;
                    }
                }
            }
        });
    }

    private async fetchAllMembers(guildId: string): Promise<Collection<string, GuildMember>> {
        const cached = membersCache.get(guildId);
        if (cached && Date.now() - cached.fetchedAt < MEMBERS_CACHE_TTL_MS) {
            return cached.members;
        }
        const guild = await this.getGuild(guildId);
        if (!guild) {
            throw new Error(`Guild with ID ${guildId} not found`);
        }
        const members = await guild.members.fetch();
        membersCache.set(guildId, { members, fetchedAt: Date.now() });
        return members;
    }

    async findMembersInRole(guildId: string, roleName: string): Promise<GuildMember[]> {
        return threadPool.submit(async () => {
            const members = await this.fetchAllMembers(guildId);
            return members.filter(member => member.roles.cache.some(role => role.name.toLocaleLowerCase() === roleName.toLocaleLowerCase())).map(member => member);
        });
    }

    async findAllRoles(guildId: string): Promise<{ name: string, id: string }[]> {
        return threadPool.submit(async () => {
            const guild = await this.getGuild(guildId);
            if (!guild) {
                throw new Error(`Guild with ID ${guildId} not found`);
            }
            const roles = await guild.roles.fetch();
            return roles.map(role => ({ name: role.name, id: role.id }));
        });
    }

    async updateNickname(discordUserId: string, nickname: string, guildId: string): Promise<{ memberId: string; characterName: string; originalNickname: string; } | void> {
        return threadPool.submit(async () => {
            const guild = await this.getGuild(guildId);
            if (!guild) {
                throw new Error(`Guild with ID ${guildId} not found`);
            }
            const member = await guild.members.fetch(discordUserId);
            const originalNickname = member.nickname || member.user.username;
            await member.setNickname(nickname);
            return {
                memberId: member.id,
                characterName: nickname,
                originalNickname
            };
        });
    }

    async getMember(discordUserId: string, guildId: string): Promise<GuildMember | null> {
        const response = await threadPool.submit(async () => {
            const guild = await this.getGuild(guildId);
            if (!guild) {
                throw new Error(`Guild with ID ${guildId} not found`);
            }
            try {
                const cached = guild.members.cache.get(discordUserId);
                if (cached) {
                    return cached;
                }
                return await guild.members.fetch(discordUserId);
            } catch (error: any) {
                if (error.code === 10007) { // Unknown Member
                    return null;
                }
                throw error;
            }
        });

        return response;
    }

    async existsMember(discordUserId: string, guildId: string): Promise<boolean> {
        return threadPool.submit(async () => {
            try {
                const member = await this.getMember(discordUserId, guildId);
                return member !== null;
            } catch (error: any) {
                if (error.code === 10007) { // Unknown Member
                    return false;
                }
                throw error;
            }
        })
    }
}