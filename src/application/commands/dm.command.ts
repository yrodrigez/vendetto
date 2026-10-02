import {
    ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";
import { DiscordCommand } from "@/infrastructure/discord/commands/command.interface";

type FailedUser = { input: string; reason: string };

export class DmCommand implements DiscordCommand {
    public data = new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Send a direct message to one or more users (Admin only)')
        .addStringOption(option =>
            option.setName('users')
                .setDescription('Comma-separated @mentions or usernames.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send')
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

        const message = interaction.options.getString('message', true);
        const usersArg = interaction.options.getString('users', true);

        const tokens = this.splitTokens(usersArg);
        const resolved: string[] = [];
        const failed: FailedUser[] = [];

        for (const token of tokens) {
            try {
                const userId = await this.resolveUserId(interaction, token);
                if (!userId) {
                    failed.push({ input: token, reason: 'user not found' });
                    continue;
                }
                resolved.push(userId);
            } catch (err) {
                failed.push({ input: token, reason: err instanceof Error ? err.message : String(err) });
            }
        }

        if (resolved.length === 0) {
            await interaction.reply({
                content: `Could not resolve any users: ${failed.map(f => `${f.input} (${f.reason})`).join(', ')}`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const sent: string[] = [];
        const sendFailures: string[] = [];
        for (const userId of resolved) {
            try {
                const user = await interaction.client.users.fetch(userId);
                await user.send(message);
                sent.push(`<@${userId}>`);
            } catch (error) {
                console.error(`Error sending DM to user ${userId}:`, error);
                sendFailures.push(`<@${userId}>`);
            }
        }

        const lines: string[] = [];
        if (sent.length) lines.push(`✅ DM sent to: ${sent.join(', ')}`);
        if (sendFailures.length) lines.push(`⚠️ Failed to DM: ${sendFailures.join(', ')}`);
        if (failed.length) lines.push(`⚠️ Could not resolve: ${failed.map(f => `${f.input} (${f.reason})`).join(', ')}`);

        await interaction.reply({
            content: lines.join('\n') || 'Message sent.',
            flags: MessageFlags.Ephemeral,
        });
    }

    private splitTokens(raw: string): string[] {
        return [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))];
    }

    private async resolveUserId(interaction: ChatInputCommandInteraction, token: string): Promise<string | null> {
        const mention = token.match(/^<@!?(\d+)>$/);
        if (mention) {
            return mention[1];
        }

        const query = token.replace(/^@/, '').toLowerCase();
        const members = await interaction.guild?.members.fetch();
        if (!members) return null;

        const match = members.find(m =>
            m.user.username.toLowerCase() === query
            || m.user.tag.toLowerCase() === query
            || (m.displayName && m.displayName.toLowerCase() === query)
        );
        return match?.user.id ?? null;
    }
}
