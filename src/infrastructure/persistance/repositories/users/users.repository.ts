import { UsersRepositoryPort } from "@/application/ports/outbound/database/users-repository.port";
import { DatabaseClient } from "@/infrastructure/database/db";

export class UsersRepository implements UsersRepositoryPort {
    constructor(private readonly databaseClient: DatabaseClient) { }
    async findLinkedCharactersByUserId(userId: string): Promise<{ characterName: string; characterId: number; }[]> {
        const query = `select character->>'name' as character_name, id as character_id from ev_member where user_id = $1`;
        const result = await this.databaseClient.query<{ character_name: string; character_id: number }>(query, [userId]);
        return result.map(row => ({ characterName: row.character_name, characterId: row.character_id }));
    }

    async findDiscordIdByUserId(userId: string): Promise<string | null> {
        const query = `select provider_user_id from ev_auth.oauth_providers where user_id = $1 and provider = 'discord_oauth'`;
        const result = await this.databaseClient.query<{ provider_user_id: string }>(query, [userId]);
        return result.length > 0 ? result[0].provider_user_id : null;
    }

    async findUserIdByDiscordId(discordId: string): Promise<string | null> {
        const query = `select user_id from ev_auth.oauth_providers where provider_user_id = $1 and provider = 'discord_oauth'`;
        const result = await this.databaseClient.query<{ user_id: string }>(query, [discordId]);
        return result.length > 0 ? result[0].user_id : null;
    }

    async existsByDiscordId(discordId: string): Promise<boolean> {
        const query = `select count(1) from ev_auth.oauth_providers where provider_user_id = $1 and provider = 'discord_oauth'`;
        const result = await this.databaseClient.query<{ count: string }>(query, [discordId]);
        return parseInt(result[0].count) > 0;
    }

    async insertDiscordAccount(userId: string, discordId: string, discordUsername: string): Promise<void> {
        const query = `insert into ev_auth.oauth_providers (user_id, provider, provider_user_id, provider_username, created_at, updated_at, metadata) values ($1, 'discord_oauth', $2, $3, now(), now(), '{"source": "sync_discord_accounts_workflow"}')`;
        await this.databaseClient.query(query, [userId, discordId, discordUsername]);
    }
}