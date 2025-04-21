import fs from 'fs';
import path from 'path';
import {Client, Collection, GatewayIntentBits} from 'discord.js';
import {config} from './config';
import {addWorkflow, setupWorkflows} from "./scheduler";
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
    if (event.once) {
        console.log('Loading event:', event.name);
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        console.log('Loading event:', event.name);
        client.on(event.name, (...args) => event.execute(...args));
    }
}


const workflowsPath = path.join(__dirname, 'workflows');
for (const file of fs.readdirSync(workflowsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'))) {
    const workflow = require(path.join(workflowsPath, file));
    if (workflow.scheduler) {
        addWorkflow({
            name: workflow.name,
            execute: workflow.execute,
            ...workflow.scheduler
        });
    }
}

client.on('error', error => {
    console.error('Discord client error:', error);
});

client.login(config.token)
    .then(() => {
        console.log('Discord client logged in');
        setupWorkflows(client);
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

