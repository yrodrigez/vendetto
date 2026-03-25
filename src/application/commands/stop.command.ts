import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { DiscordCommand } from "../../infrastructure/discord/commands/command.interface";
import { DiscordPlayerAdapter } from "../../infrastructure/discord/discord-player.adapter";

export class StopCommand implements DiscordCommand {
    public data = new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback and disconnect from the voice channel');

    constructor(private readonly playerAdapter: DiscordPlayerAdapter) {}

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const stopped = this.playerAdapter.stop(interaction.guildId!);
        await interaction.reply({
            content: stopped ? 'Stopped playback.' : 'Nothing is currently playing.',
            flags: MessageFlags.Ephemeral,
        });
    }
}
