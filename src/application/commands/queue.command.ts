import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { DiscordCommand } from "../../infrastructure/discord/commands/command.interface";
import { DiscordPlayerAdapter } from "../../infrastructure/discord/discord-player.adapter";

export class QueueCommand implements DiscordCommand {
    public data = new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current playback queue');

    constructor(private readonly playerAdapter: DiscordPlayerAdapter) {}

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const { current, tracks } = this.playerAdapter.getQueue(interaction.guildId!);

        if (!current) {
            await interaction.reply({
                content: 'Nothing is currently playing.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const lines = [`Now playing: **${current.title}**`];

        if (tracks.length > 0) {
            lines.push('', '**Up next:**');
            tracks.forEach((track, index) => {
                lines.push(`${index + 1}. ${track.title}`);
            });
        }

        await interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
    }
}
