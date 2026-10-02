import {
    ChannelType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    GuildBasedChannel,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextChannel,
} from "discord.js";
import { DiscordCommand } from "@/infrastructure/discord/commands/command.interface";

type ResolvedChannel = { channel: TextChannel; label: string };
type FailedChannel = { input: string; reason: string };

export class AnnounceCommand implements DiscordCommand {
    public data = new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Create an announcement (Admin only)')
        .addStringOption(option =>
            option.setName('channel')
                .setDescription('Comma-separated channel names or #mentions. Leave blank for the current channel.')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('title')
                .setDescription('The announcement title')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The announcement message')
                .setRequired(true)
        );

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.guildId) {
            await interaction.reply({
                content: 'This command can only be used in a server.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const permissions = interaction.memberPermissions;
        const isAdmin = permissions?.has(PermissionFlagsBits.Administrator)
            || permissions?.has(PermissionFlagsBits.ManageMessages);
        if (!isAdmin) {
            await interaction.reply({
                content: 'You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const title = interaction.options.getString('title', true);
        const message = interaction.options.getString('message', true);

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(message)
            .setColor(0x9B59B6)
            .setAuthor({
                name: interaction.user.username,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setTimestamp();

        const channelArg = interaction.options.getString('channel')?.trim();
        let resolved: ResolvedChannel[] = [];
        let failed: FailedChannel[] = [];

        if (channelArg) {
            const tokens = this.splitTokens(channelArg);
            for (const token of tokens) {
                try {
                    const channel = await this.resolveChannel(interaction, token);
                    if (!channel) {
                        failed.push({ input: token, reason: 'not found or not a text channel' });
                        continue;
                    }
                    resolved.push({ channel, label: token });
                } catch (err) {
                    failed.push({ input: token, reason: err instanceof Error ? err.message : String(err) });
                }
            }
        } else {
            const current = interaction.channel;
            if (current && (current.type === ChannelType.GuildText || current.type === ChannelType.GuildAnnouncement)) {
                resolved.push({ channel: current as TextChannel, label: 'current channel' });
            } else {
                await interaction.reply({
                    content: 'The current channel is not a text or announcement channel.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
        }

        if (resolved.length === 0) {
            await interaction.reply({
                content: `Could not resolve any channels: ${failed.map(f => `${f.input} (${f.reason})`).join(', ')}`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const sent: string[] = [];
        const sendFailures: string[] = [];
        for (const { channel } of resolved) {
            try {
                await channel.send({ embeds: [embed] });
                sent.push(`<#${channel.id}>`);
            } catch (error) {
                console.error(`Error sending announcement to channel ${channel.id}:`, error);
                sendFailures.push(`<#${channel.id}>`);
            }
        }

        const lines: string[] = [];
        if (sent.length) lines.push(`✅ Posted to: ${sent.join(', ')}`);
        if (sendFailures.length) lines.push(`⚠️ Failed to send to: ${sendFailures.join(', ')}`);
        if (failed.length) lines.push(`⚠️ Could not resolve: ${failed.map(f => `${f.input} (${f.reason})`).join(', ')}`);

        await interaction.reply({
            content: lines.join('\n') || 'Announcement posted.',
            flags: MessageFlags.Ephemeral,
        });
    }

    private splitTokens(raw: string): string[] {
        return [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))];
    }

    private async resolveChannel(interaction: ChatInputCommandInteraction, token: string): Promise<TextChannel | null> {
        const guild = interaction.guild;
        const mention = token.match(/^<#(\d+)>$/);
        if (mention) {
            const channel = await guild?.channels.fetch(mention[1]).catch(() => undefined);
            return this.asTextChannel(channel);
        }

        const name = token.replace(/^#/, '').toLowerCase();
        const channels = await guild?.channels.fetch();
        if (!channels) return null;
        const match = channels.find(c => c !== null && c.name.toLowerCase() === name);
        return this.asTextChannel(match);
    }

    private asTextChannel(channel: GuildBasedChannel | null | undefined): TextChannel | null {
        if (!channel) return null;
        if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
            return channel as TextChannel;
        }
        return null;
    }
}
