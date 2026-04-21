import { Client, VoiceState } from 'discord.js'
import { VoiceModerationSession } from './voice-moderation-session'

export class VoiceModerationRegistry {
    private readonly sessions = new Map<string, VoiceModerationSession>()
    private voiceStateHandler: ((oldState: VoiceState, newState: VoiceState) => void) | null = null

    register(session: VoiceModerationSession): void {
        this.sessions.set(session.guildId, session)
    }

    get(guildId: string): VoiceModerationSession | undefined {
        return this.sessions.get(guildId)
    }

    async unregister(guildId: string): Promise<void> {
        const session = this.sessions.get(guildId)
        if (!session) return
        this.sessions.delete(guildId)
        await session.stop()
    }

    attachToClient(client: Client): void {
        if (this.voiceStateHandler) return
        this.voiceStateHandler = (oldState, newState) => {
            const session = this.sessions.get(oldState.guild.id)
            if (!session) return

            const wasInModeratedChannel = oldState.channelId === session.channelId
            const isInModeratedChannel = newState.channelId === session.channelId

            if (wasInModeratedChannel && !isInModeratedChannel) {
                const userId = oldState.id
                console.log(`[VoiceModRegistry] user left moderated channel user=${userId} guild=${oldState.guild.id}`)
                void session.handleUserLeave(userId)
            }
        }
        client.on('voiceStateUpdate', this.voiceStateHandler)
    }
}
