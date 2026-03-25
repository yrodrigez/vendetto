import { ChatInputCommandInteraction, GuildMember, MessageFlags, SlashCommandBuilder, VoiceBasedChannel } from "discord.js";
import { DiscordCommand } from "../../infrastructure/discord/commands/command.interface";
import { DiscordPlayerAdapter } from "../../infrastructure/discord/discord-player.adapter";

export class PlayCommand implements DiscordCommand {
    public data = new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from YouTube in your current voice channel')
        .addStringOption(option =>
            option.setName('query').setDescription('Song name or YouTube URL').setRequired(true)
        );

    constructor(private readonly playerAdapter: DiscordPlayerAdapter) {}

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const voiceChannel = (interaction.member as GuildMember)?.voice?.channel as VoiceBasedChannel | null;

        if (!voiceChannel) {
            await interaction.reply({
                content: 'You must be in a voice channel.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const query = interaction.options.getString('query', true);
        await interaction.deferReply();

        try {
            const { track, addedToQueue } = await this.playerAdapter.play(voiceChannel, query);
            const message = addedToQueue
                ? `Added to queue: **${track.title}**\n${track.url}`
                : `Now playing: **${track.title}**\n${track.url}`;
            await interaction.editReply(message);
        } catch (error: any) {
            await interaction.editReply(`Failed to play: ${error?.message ?? 'Unknown error'}`);
        }
    }
}
