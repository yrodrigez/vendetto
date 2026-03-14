import { DiscordEvent } from "@/infrastructure/discord/events/event.interface";
import { Events } from "discord.js";
import { DiscordChannelLoggerPort } from "../ports/outbound/discord-channel-logger.port";

export class InteractionCreateEvent implements DiscordEvent {
    public readonly name = Events.InteractionCreate;
    public readonly once = false;

    constructor(
        private readonly logger: DiscordChannelLoggerPort,
    ) { }

    async execute(interaction: any): Promise<void> {
        console.log(`Received interaction: ${interaction.type} from ${interaction.user.tag}`);
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            await this.logger.log(interaction.channelId, `No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}`);
            console.error(error);
            await this.logger.log(interaction.channelId, `Error executing command ${interaction.commandName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}