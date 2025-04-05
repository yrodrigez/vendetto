import dotenv from 'dotenv';

dotenv.config();

interface Config {
    token: string;
    clientId: string;
    guildId: string;
    channels: {
        [key: string]: string;
    }
}

export const config: Config = {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.CLIENT_ID || '',
    guildId: process.env.GUILD_ID || '',
    channels: {
        general: process.env.GENERAL_CHANNEL_ID || '',
    },
};

if (!config.token) {
    throw new Error('DISCORD_TOKEN is missing in .env file');
}