export interface DiscordChannelLoggerPort {
    log(guildId: string, message: string): Promise<void>
}