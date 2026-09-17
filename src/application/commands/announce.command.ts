import {
    ChannelType,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextChannel,
} from "discord.js";
import { DiscordCommand } from "@/infrastructure/discord/commands/command.interface";

export class AnnounceCommand implements DiscordCommand {
    public data = new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Create an announcement (Admin only)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to post the announcement to')
                .setRequired(true)
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

        const channel = interaction.options.getChannel('channel', true);
        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
            await interaction.reply({
                content: 'The selected channel must be a text or announcement channel.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const textChannel = channel as TextChannel;
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

        try {
            await textChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`Error sending announcement to channel ${channel.id}:`, error);
            await interaction.reply({
                content: `Failed to send the announcement. Make sure the bot has permission to send messages in <#${channel.id}>.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await interaction.reply({
            content: `Announcement posted in <#${channel.id}>.`,
            flags: MessageFlags.Ephemeral,
        });
    }
}
