import { DiscordChannelPort } from "@/application/ports/outbound/discord-channel.port";
import { getDiscordClient } from "./discord-api.adapter";
import { ChannelType, OverwriteType, PermissionFlagsBits, TextChannel } from "discord.js";

export class DiscordChannelAdapter implements DiscordChannelPort {
    async createTextChannel(guildId: string, options: {
        name: string;
        categoryName: string;
        topic?: string;
        isPrivate: boolean;
    }): Promise<string> {
        const client = await getDiscordClient();
        const guild = await client.guilds.fetch(guildId);

        let category = guild.channels.cache.find(
            ch => ch.type === ChannelType.GuildCategory && ch.name === options.categoryName
        );
        if (!category) {
            category = await guild.channels.create({
                name: options.categoryName,
                type: ChannelType.GuildCategory,
            });
        }

        const permissionOverwrites = options.isPrivate
            ? [{
                id: guild.roles.everyone.id,
                type: OverwriteType.Role,
                deny: [PermissionFlagsBits.ViewChannel],
            }]
            : [];

        const channel = await guild.channels.create({
            name: options.name,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: options.topic,
            permissionOverwrites,
        });

        return channel.id;
    }

    async addMemberToChannel(channelId: string, memberId: string): Promise<void> {
        const client = await getDiscordClient();
        const channel = await client.channels.fetch(channelId);
        if (!channel || channel.type !== ChannelType.GuildText) return;

        await (channel as TextChannel).permissionOverwrites.create(memberId, {
            ViewChannel: true,
            SendMessages: true,
        });
    }

    async deleteChannel(channelId: string): Promise<void> {
        const client = await getDiscordClient();
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            await channel.delete();
        }
    }

    async sendMessage(channelId: string, content: string): Promise<void> {
        const client = await getDiscordClient();
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.type === ChannelType.GuildText) {
            await (channel as TextChannel).send(content);
        }
    }

    async getChannelMembers(channelId: string): Promise<string[]> {
        const client = await getDiscordClient();
        const channel = await client.channels.fetch(channelId);
        if (!channel || channel.type !== ChannelType.GuildText) return [];

        const textChannel = channel as TextChannel;
        return textChannel.permissionOverwrites.cache
            .filter(overwrite => overwrite.type === OverwriteType.Member)
            .map(overwrite => overwrite.id);
    }
}
