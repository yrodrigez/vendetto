import { DiscordMembersRepositoryPort } from "@/application/ports/outbound/database/discord-members-repository.port";
import { DatabaseClient } from "@/infrastructure/database/db";

export class DiscordMembersRepository implements DiscordMembersRepositoryPort {
    constructor(private readonly databaseClient: DatabaseClient) { }
    
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