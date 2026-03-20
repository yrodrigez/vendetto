export interface UsersRepositoryPort {
    findDiscordIdByUserId(userId: string): Promise<string | null>;
    findUserIdByDiscordId(discordId: string): Promise<string | null>;
    existsByDiscordId(discordId: string): Promise<boolean>;
    insertDiscordAccount(userId: string, discordId: string, discordUsername: string): Promise<void>;
    findLinkedCharactersByUserId(userId: string): Promise<{ characterName: string, characterId: number }[]>;
}