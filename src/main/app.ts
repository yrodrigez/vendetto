import { ensureClientReady } from '@/infrastructure/discord/discord-api.adapter'
import { startWorkflows } from './start-workflows'
import { startCommands } from './start-discord-bot'

export class App {
    static async start() {
        await ensureClientReady()
        await startCommands()
        await startWorkflows()
    }
}
