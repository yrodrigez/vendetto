import { DiscordMembersRepositoryPort } from "@/application/ports/outbound/database/discord-members-repository.port";
import { DatabaseClient } from "@/infrastructure/database/db";

export class DiscordMembersRepository implements DiscordMembersRepositoryPort {
    constructor(private readonly databaseClient: DatabaseClient) { }
    async findAllByUserIds(discordUserIds: string[]): Promise<{ id: number; discord_user_id: string; member_id: number; }[]> {
        if (discordUserIds.length === 0) {
            return [];
        }

        const query = `select id, discord_user_id, member_id from public.discord_members where discord_user_id = any($1::text[])`;
        const result = await this.databaseClient.query<{ id: number; discord_user_id: string; member_id: number }>(query, [discordUserIds]);
        return result;
    }

    async insertMany(params: { discordUserId: string; memberId: number; discordUser: { id: string; username: string; }; memberName: string; guildId: string; }[]): Promise<{ id: number; discord_user_id: string; member_id: number; }[]> {
        if (params.length === 0) {
            return [];
        }

        const query = `insert into public.discord_members (discord_user_id, member_id, discord_user, name) 
        values ${params.map((_, index) => `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`).join(', ')} 
        ON CONFLICT (member_id, discord_user_id) DO UPDATE SET 
            discord_user = EXCLUDED.discord_user, 
            name = EXCLUDED.name, 
            updated_at = now()
        returning id, discord_user_id, member_id`;
        const queryParams = params.flatMap(param => [param.discordUserId, param.memberId, param.discordUser, param.memberName]);
        const result = await this.databaseClient.query<{ id: number; discord_user_id: string; member_id: number }>(query, queryParams);
        return result;
    }
    
    async existsByDiscordUserId(discordUserId: string): Promise<boolean> {
        const query = `select count(1) from public.discord_members where discord_user_id = $1`;
        const result = await this.databaseClient.query<{ count: string }>(query, [discordUserId]);
        return parseInt(result[0].count) > 0;
    }

    async findByDiscordUserId(discordUserId: string): Promise<{ id: number; discord_user_id: string; member_id: number; } | null> {
        const query = `select id, discord_user_id, member_id from public.discord_members where discord_user_id = $1`;
        const result = await this.databaseClient.query<{ id: number; discord_user_id: string; member_id: number }>(query, [discordUserId]);
        return result.length > 0 ? result[0] : null;
    }

    async insert({ discordUserId, memberId, discordUser, memberName }: {
        discordUserId: string,
        memberId: number,
        discordUser: { id: string, username: string },
        memberName: string,
    }): Promise<{ id: number, discord_user_id: string, member_id: number }> {

        const query = `insert into public.discord_members (discord_user_id, member_id, discord_user, name) values ($1, $2, $3, $4) returning id, discord_user_id, member_id`;
        const result = await this.databaseClient.query<{ id: number, discord_user_id: string, member_id: number }>(query, [discordUserId, memberId, discordUser, memberName]);
        return result[0];
    }
}