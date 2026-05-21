import { DiscordChannelPort } from "@/application/ports/outbound/discord-channel.port";
import { DiscordTextChannelPort, DiscordTextMessage } from "@/application/ports/outbound/discord-text-channel.port";
import { getDiscordClient } from "./discord-api.adapter";
import { ChannelType, Message, OverwriteType, PermissionFlagsBits, TextChannel } from "discord.js";

export class DiscordChannelAdapter implements DiscordChannelPort, DiscordTextChannelPort {
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

    async findTextChannelByName(guildId: string, channelName: string): Promise<string | null> {
        const client = await getDiscordClient();
        const guild = await client.guilds.fetch(guildId);
        const channels = await guild.channels.fetch();
        const channel = channels.find(ch => ch?.type === ChannelType.GuildText && ch.name === channelName);

        return channel?.id ?? null;
    }

    async findRecentMessages(channelId: string, since: Date): Promise<DiscordTextMessage[]> {
        const client = await getDiscordClient();
        const channel = await client.channels.fetch(channelId);
        if (!channel || channel.type !== ChannelType.GuildText) return [];

        const textChannel = channel as TextChannel;
        const messages: DiscordTextMessage[] = [];
        let before: string | undefined;

        while (true) {
            const fetched = await textChannel.messages.fetch({ limit: 100, before });
            if (!fetched.size) break;

            let reachedOldMessages = false;
            for (const message of fetched.values()) {
                if (message.createdAt < since) {
                    reachedOldMessages = true;
                    continue;
                }

                const content = this.extractMessageContent(message);
                if (!content) continue;

                messages.push({
                    id: message.id,
                    authorName: message.author.username,
                    content,
                    createdAt: message.createdAt,
                    url: message.url,
                });
            }

            if (reachedOldMessages || fetched.size < 100) break;

            const oldestMessage = fetched.reduce((oldest, message) =>
                message.createdTimestamp < oldest.createdTimestamp ? message : oldest
            );
            before = oldestMessage.id;
        }

        return messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    private extractMessageContent(message: Message): string {
        const parts = [message.content.trim()];

        for (const embed of message.embeds) {
            parts.push(embed.title?.trim() ?? '');
            parts.push(embed.description?.trim() ?? '');
            parts.push(embed.url?.trim() ?? '');
        }

        return parts.filter(Boolean).join('\n');
    }
}
