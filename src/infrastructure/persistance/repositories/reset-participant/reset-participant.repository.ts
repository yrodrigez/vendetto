import { ActiveReset, ResetParticipantRepositoryPort, ResetSubscribedMember } from "@/application/ports/outbound/database/reset-participant-repository.port";
import { DatabaseClient } from "@/infrastructure/database/db";

export class ResetParticipantRepository implements ResetParticipantRepositoryPort {
    constructor(private readonly databaseClient: DatabaseClient) { }

    async findSubscribedMembers(resetId: string): Promise<ResetSubscribedMember[]> {
        const query = `
            SELECT op.provider_user_id AS discord_user_id
            FROM public.ev_raid_participant rp
            INNER JOIN public.ev_member m ON m.id = rp.member_id
            INNER JOIN ev_auth.oauth_providers op ON op.user_id = m.user_id
            WHERE rp.raid_id = $1
              AND (rp.details->>'status' IS NULL OR rp.details->>'status' != 'declined')
              AND op.provider LIKE '%discord%'
            UNION
            SELECT dm.discord_user_id
            FROM public.ev_raid_participant rp
            INNER JOIN public.discord_members dm ON dm.member_id = rp.member_id
            WHERE rp.raid_id = $1
              AND (rp.details->>'status' IS NULL OR rp.details->>'status' != 'declined')
        `;
        const results = await this.databaseClient.query<{ discord_user_id: string }>(query, [resetId]);
        return results.map(row => ({ discordUserId: row.discord_user_id }));
    }

    async findActiveResets(): Promise<ActiveReset[]> {
        const query = `
            SELECT rr.id, r.name AS raid_name, rr.raid_date, rr.time, rr.end_date, rr.end_time
            FROM public.raid_resets rr
            INNER JOIN public.ev_raid r ON r.id = rr.raid_id
            WHERE (rr.raid_date + rr.time) > NOW() - interval '8 hours'
              AND (rr.status IS NULL OR (rr.status != 'offline' AND rr.status != 'locked'))
            ORDER BY rr.raid_date, rr.time
        `;
        const results = await this.databaseClient.query<{
            id: string; raid_name: string; raid_date: string; time: string; end_date: string; end_time: string;
        }>(query);
        return results.map(row => ({
            id: row.id,
            raid: { name: row.raid_name },
            raid_date: row.raid_date,
            time: row.time,
            end_date: row.end_date,
            end_time: row.end_time,
        }));
    }
}
