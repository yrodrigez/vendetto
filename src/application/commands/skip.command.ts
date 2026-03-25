import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { DiscordCommand } from "../../infrastructure/discord/commands/command.interface";
import { DiscordPlayerAdapter } from "../../infrastructure/discord/discord-player.adapter";

export class SkipCommand implements DiscordCommand {
    public data = new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current track');

    constructor(private readonly playerAdapter: DiscordPlayerAdapter) {}

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const skipped = this.playerAdapter.skip(interaction.guildId!);
        await interaction.reply({
            content: skipped ? 'Skipped!' : 'Nothing is currently playing.',
            flags: MessageFlags.Ephemeral,
        });
    }
}
