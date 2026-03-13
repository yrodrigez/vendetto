import { ChannelType, Client } from "discord.js";
import { getDiscordClient } from "./discord-api.adapter";
import { DiscordChannelLoggerPort } from "@/application/ports/outbound/discord-channel-logger.port";

export class LogChannelEntry implements DiscordChannelLoggerPort {
    private isInitialized: boolean = false
    private client: Client | null = null

    private async initialize() {
        const client = await getDiscordClient();
        this.client = client;
        this.isInitialized = true;
    }

    private async send(message: string, guildId: string): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (!this.client) return;

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return;

        const channel = guild.channels.cache.find(channel => {
            return channel.type === ChannelType.GuildText && channel.name === 'vendetto-system';
        });

        if (channel && channel.isTextBased()) {
            await channel.send(message);
        }
    }

    async log(guildId: string, message: string): Promise<void> {
        await this.send(message, guildId);
    }
}