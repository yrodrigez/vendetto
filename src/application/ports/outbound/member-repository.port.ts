export interface MemberRepositoryPort {
    findAllSelectedCharactersDiscord(): Promise<{ discordId: string, character: { name: string, class: string, guild: string, realmSlug: string, id: number } }[]>
    findAllInRealm(realmSlug: string): Promise<{ discordId: string, character: { name: string, class: string, guild: string, realmSlug: string } }[]>
    findAllInGuild(guildName: string): Promise<{ discordId: string, character: { name: string, class: string, guild: string, realmSlug: string, id: string } }[]>
    findAllSelectedCharacters(): Promise<{ name: string, class: string, guild: string, realmSlug: string, id: number }[]>
}