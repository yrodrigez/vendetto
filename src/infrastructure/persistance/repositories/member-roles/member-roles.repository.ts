import { MemberRolesRepositoryPort } from "@/application/ports/outbound/member-roles-repository.port";
import { DatabaseClient } from "@/infrastructure/database/db";

export class MemberRolesRepository implements MemberRolesRepositoryPort {
    constructor(private databaseClient: DatabaseClient) { }
    async findRolesForMember(discordId: string): Promise<string[]> {
        const query = `
            with discord_roles as (
                select 
                    distinct p.provider_user_id as discord_id,
                    r.role as role,
                    r.member_name as name
                from ev_member_role r 
                    join ev_auth.oauth_providers p on p.user_id = r.user_id
                    where p.provider = 'discord_oauth'
                ), 
            legacy_discord_member_roles as (
                select 
                    m.discord_user_id as discord_id, 
                    r.role as role, 
                    r.member_name as name 
                from public.discord_members m
                    inner join ev_member_role r on r.member_id = m.member_id
                    inner join ev_member em on em.id = m.member_id and em.user_id = r.user_id
            ) 
            select discord_id, role, name from (select * from discord_roles union select * from legacy_discord_member_roles) as union_result where discord_id = $1`
        const result = await this.databaseClient.query<{ discord_id: string, role: string, name: string }>(query, [discordId]);
        return result.map(r => r.role)
    }
}