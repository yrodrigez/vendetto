import {Client, Collection, GatewayIntentBits} from 'discord.js';
import fs from 'fs';
import path from 'path';
import {config} from './config';
import {addScheduledEvent, setupScheduledEvents} from "./scheduler";

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
    ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js')).forEach(file => {
    const command = require(path.join(commandsPath, file));

    if ('data' in command && 'execute' in command) {
        console.log('Loading command:', command.data.name);
        client.commands.set(command.data.name, command);
    }
});

const {channels} = config;
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'))) {
    const event = require(path.join(eventsPath, file));
    if(event.scheduler) {
        console.log('Loading scheduled event:', event.name);
        addScheduledEvent({
            name: event.name,
            type: event.scheduler.type,
            time: event.scheduler.time,
            execute: event.execute,
        });
    }
    if (event.once) {
        console.log('Loading event:', event.name);
        client.once(event.name, (...args) => event.execute(channels, ...args));
    } else {
        console.log('Loading event:', event.name);
        client.on(event.name, (...args) => event.execute(channels, ...args));
    }
}

client.on('error', error => {
    console.error('Discord client error:', error);
});

client.login(config.token)
    .then(() => {
        console.log('Discord client logged in');
        setupScheduledEvents(channels, client);
    })
    .catch(error => {
    console.error('Failed to login:', error);
    console.error('Token used:', config.token ? '[TOKEN SET]' : '[TOKEN MISSING]');
});

