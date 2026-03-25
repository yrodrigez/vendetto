import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { DiscordCommand } from "../../infrastructure/discord/commands/command.interface";
import { DiscordPlayerAdapter } from "../../infrastructure/discord/discord-player.adapter";

export class VolumeCommand implements DiscordCommand {
    public data = new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set or show the playback volume')
        .addIntegerOption(option =>
            option.setName('level').setDescription('Volume level (0-100)').setMinValue(0).setMaxValue(100)
        );

    constructor(private readonly playerAdapter: DiscordPlayerAdapter) {}

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const level = interaction.options.getInteger('level');

        if (level === null) {
            const current = this.playerAdapter.getVolume(interaction.guildId!);
            if (current === null) {
                await interaction.reply({ content: 'Nothing is currently playing.', flags: MessageFlags.Ephemeral });
                return;
            }
            await interaction.reply({ content: `Current volume: **${current}%**.`, flags: MessageFlags.Ephemeral });
            return;
        }

        const success = this.playerAdapter.setVolume(interaction.guildId!, level);
        if (!success) {
            await interaction.reply({ content: 'Nothing is currently playing.', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.reply({ content: `Volume set to **${level}%**.`, flags: MessageFlags.Ephemeral });
    }
}
