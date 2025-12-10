import 'dotenv/config';

const environment = {
    environment: process.env.NODE_ENV!,
    port: process.env.PORT!,
    discordToken: process.env.DISCORD_TOKEN!,
    discordClientId: process.env.CLIENT_ID!,
    supabaseAnnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    postgres: {
        host: process.env.POSTGRES_HOST!,
        port: process.env.POSTGRES_PORT!,
        database: process.env.POSTGRES_DATABASE!,
        user: process.env.POSTGRES_USER!,
        password: process.env.POSTGRES_PASSWORD!,
        ssl: process.env.POSTGRES_SSL === 'true'
    }
} as const;

function validateEnvironment(env: any) {
    for (const [key, value] of Object.entries(env)) {
        if (typeof value === 'object' && value !== null) {
            validateEnvironment(value);
            continue;
        }
        if (value === undefined || value === '') {
            throw new Error(`Environment variable ${key} is missing or empty`);
        }
    }
}

validateEnvironment(environment);
export const getEnvironmentVariable = () => {
    return environment;
}