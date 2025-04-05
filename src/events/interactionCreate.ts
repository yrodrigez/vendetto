// src/events/interactionCreate.ts
import {Interaction, Events} from "discord.js";

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    execute(interaction: Interaction) {
        console.log(`Received interaction: ${interaction.type} from ${interaction.user.tag}`);

        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            command.execute(interaction);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}`);
            console.error(error);
        }
    },
};