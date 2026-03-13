import { DiscordApiPort } from "@/application/ports/outbound/discord-api.port";
import { Client, Collection, GatewayIntentBits, GuildMember, OAuth2Guild } from 'discord.js';
import { getEnvironment } from "@/infrastructure/environment";
import threadPool from "@/util/thread-pool";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildIntegrations
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

export async function getGuilds(): Promise<Collection<string, OAuth2Guild>> {
    const client = await getDiscordClient();
    return client.guilds.fetch();
}

export class DiscordApiAdapter implements DiscordApiPort {
    async updateNickname(discordUserId: string, nickname: string, guildId: string): Promise<{ memberId: string; characterName: string; originalNickname: string; } | void> {
        return threadPool.submit(async () => {
            const client = await getDiscordClient();
            const guild = await client.guilds.fetch(guildId);
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
        const client = await getDiscordClient();
        const guild = await client.guilds.fetch(guildId);
        try {
            return await guild.members.fetch(discordUserId);
        } catch (error: any) {
            if (error.code === 10007) { // Unknown Member
                return null;
            }
            throw error;
        }
    }

    async existsMember(discordUserId: string, guildId: string): Promise<boolean> {
        try {
            const member = await this.getMember(discordUserId, guildId);
            return member !== null;
        } catch (error: any) {
            if (error.code === 10007) { // Unknown Member
                return false;
            }
            throw error;
        }
    }
}