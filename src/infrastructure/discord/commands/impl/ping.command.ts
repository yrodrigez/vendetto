import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { DiscordCommand } from "../command.interface";


export class PingCommand implements DiscordCommand {
    public data = new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Pongs the bot');

    constructor(
    ) { }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.reply({
            content: `Pong!`,
            ephemeral: false
        });
    }
}