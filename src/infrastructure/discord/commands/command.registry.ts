import { Client, Collection, REST, Routes } from "discord.js";
import { DiscordCommand } from "./command.interface";
import { getEnvironment } from "@/infrastructure/environment";

export class CommandRegistry {
    private commands: Collection<string, DiscordCommand> = new Collection();

    register(command: DiscordCommand) {
        this.commands.set(command.data.name, command);
        console.log(`Registered command: ${command.data.name}`);
    }

    async applyToClient(client: Client) {
        if (!client.commands) {
            client.commands = new Collection();
        }
        // We still need to load the commands into memory so the interaction handler 
        // in src/events/interactionCreate.ts can find the executable code!
        for (const [name, command] of this.commands) {
            client.commands.set(name, command);
            console.log(`Applied command to memory: ${name}`);
        }

        const { discordToken } = getEnvironment();
        const rest = new REST().setToken(discordToken);
        const commandData = this.commands.map(command => command.data.toJSON());
        await Promise.all(client.guilds.cache.map(async ({ id }) => {
            try {
                console.log(`Registering slash commands for guild: ${id}`);
                await rest.put(Routes.applicationGuildCommands(client.user!.id, id), { body: commandData });
            } catch (err) {
                console.error(`Failed to register slash commands for guild ${id}`, err);
            }
        }));
        console.log(`Applied ${this.commands.size} commands to client`);
    }

    getCommands(): DiscordCommand[] {
        return Array.from(this.commands.values());
    }
}

// Extend Discord.js Client type to include commands property
declare module 'discord.js' {
    interface Client {
        commands: Collection<string, DiscordCommand>;
    }
}
