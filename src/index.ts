import {Client, Collection, GatewayIntentBits,} from 'discord.js';
import fs from 'fs';
import path from 'path';
import {config} from './config';
import {addScheduledEvent, setupScheduledEvents} from "./scheduler";
import {deployCommands} from "./util/deployCommands";

declare module 'discord.js' {
    interface Client {
        commands: Collection<string, any>;
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildIntegrations
    ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js')).forEach(file => {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
});

const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'))) {
    const event = require(path.join(eventsPath, file));
    if (event.scheduler) {
        addScheduledEvent({
            name: event.name,
            execute: event.execute,
            ...event.scheduler
        });
    }
    if (event.once) {
        console.log('Loading event:', event.name);
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        console.log('Loading event:', event.name);
        client.on(event.name, (...args) => event.execute(...args));
    }
}

client.on('error', error => {
    console.error('Discord client error:', error);
});

client.login(config.token)
    .then(() => {
        console.log('Discord client logged in');
        setupScheduledEvents(client);
        deployCommands(
            config.token,
            config.clientId,
            client.commands,
            client
        ).then(() => {
            console.log('Commands deployment done');
        }).catch(error => {
            console.error('Failed to deploy commands:', error);
        });

    })
    .catch(error => {
        console.error('Failed to login:', error);
        console.error('Token used:', config.token ? '[TOKEN SET]' : '[TOKEN MISSING]');
    });

