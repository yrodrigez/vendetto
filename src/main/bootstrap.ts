import { ensureClientReady } from '@/infrastructure/discord/discord-api.adapter'
import { startWorkflows } from './start-workflows'
import { startCommands } from './start-discord-bot'

async function bootstrap() {
    await ensureClientReady()
    await startCommands()
    await startWorkflows()
}

void bootstrap()
