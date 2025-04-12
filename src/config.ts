import dotenv from 'dotenv';

dotenv.config();

interface Config {
    token: string;
    clientId: string;
}

export const config: Config = {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.CLIENT_ID || '',
};

if (!config.token) {
    throw new Error('DISCORD_TOKEN is missing in .env file');
}

interface PostgresConfig {
    host: string;
    password: string;
    port: string;
    user: string;
    database: string;
    ssl: boolean;
}

export const postgresConfig: PostgresConfig = {
    host: process.env.POSTGRES_HOST || '',
    password: process.env.POSTGRES_PASSWORD || '',
    port: process.env.POSTGRES_PORT || '',
    user: process.env.POSTGRES_USER || '',
    database: process.env.POSTGRES_DATABASE || '',
    ssl: process.env.POSTGRES_SSL === 'true',
};