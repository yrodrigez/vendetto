import { ResetChannel, ResetChannelRepositoryPort } from "@/application/ports/outbound/reset-channel-repository.port";
import { DatabaseClient } from "@/infrastructure/database/db";

function resetChannelMapper(row: any): ResetChannel {
    return {
        id: row.id,
        resetId: row.reset_id,
        channelId: row.channel_id,
        guildId: row.guild_id,
    };
}

function activeResetChannelMapper(row: any): ResetChannel {
    return {
        ...resetChannelMapper(row),
        raidName: row.raid_name,
        raidDatetime: row.raid_datetime,
    };
}

export class ResetChannelRepository implements ResetChannelRepositoryPort {
    constructor(private readonly databaseClient: DatabaseClient) { }

    async findByResetId(resetId: string): Promise<ResetChannel | null> {
        const query = `SELECT id, reset_id, channel_id, guild_id FROM public.raid_reset_channels WHERE reset_id = $1`;
        const results = await this.databaseClient.query(query, [resetId]);
        return results.length > 0 ? resetChannelMapper(results[0]) : null;
    }

    async findByChannelId(channelId: string): Promise<ResetChannel | null> {
        const query = `SELECT id, reset_id, channel_id, guild_id FROM public.raid_reset_channels WHERE channel_id = $1`;
        const results = await this.databaseClient.query(query, [channelId]);
        return results.length > 0 ? resetChannelMapper(results[0]) : null;
    }

    async findAllActive(): Promise<ResetChannel[]> {
        const query = `
            SELECT rc.id, rc.reset_id, rc.channel_id, rc.guild_id,
                   r.name AS raid_name,
                   ((rr.raid_date + rr.time) AT TIME ZONE 'Europe/Madrid'::text) AS raid_datetime
            FROM public.raid_reset_channels rc
            INNER JOIN public.raid_resets rr ON rr.id = rc.reset_id
            INNER JOIN public.ev_raid r ON r.id = rr.raid_id
            WHERE (rr.end_date + rr.end_time) + interval '8 hours' > NOW()
        `;
        const results = await this.databaseClient.query(query);
        return results.map(activeResetChannelMapper);
    }

    async findExpired(): Promise<ResetChannel[]> {
        const query = `
            SELECT rc.id, rc.reset_id, rc.channel_id, rc.guild_id
            FROM public.raid_reset_channels rc
            INNER JOIN public.raid_resets rr ON rr.id = rc.reset_id
            WHERE (rr.end_date + rr.end_time) + interval '8 hours' <= NOW()
        `;
        const results = await this.databaseClient.query(query);
        return results.map(resetChannelMapper);
    }

    async insert(data: { resetId: string; channelId: string; guildId: string }): Promise<void> {
        const query = `INSERT INTO public.raid_reset_channels (reset_id, channel_id, guild_id) VALUES ($1, $2, $3)`;
        await this.databaseClient.query(query, [data.resetId, data.channelId, data.guildId]);
    }

    async deleteByResetId(resetId: string): Promise<void> {
        const query = `DELETE FROM public.raid_reset_channels WHERE reset_id = $1`;
        await this.databaseClient.query(query, [resetId]);
    }
}
