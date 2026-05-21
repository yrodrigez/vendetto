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
    },
    evApi: {
        baseUrl: process.env.EV_API_BASE_URL!,
        token: process.env.EV_API_TOKEN!,
    },
    selectedAIProvider: process.env.AI_PROVIDER || 'ollama',
    aiProviders: {
        ollama: {
            baseUrl: process.env.OLLAMA_BASE_URL!,
            model: process.env.OLLAMA_MODEL || 'gpt-oss:20b',
        },
        openai: {
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY || 'not-set',
        },
        anthropic: {
            model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
            apiKey: process.env.ANTHROPIC_API_KEY || 'not-set',
        }
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
export const getEnvironment = () => {
    return environment;
}