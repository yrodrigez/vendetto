import { DatabaseClient } from "@/infrastructure/database/db";

export class SeedMemberRepository {

    constructor(
        private readonly db: DatabaseClient
    ) { }

    async findAll() {
        const sql = `SELECT discord_id FROM open_campaign.seeds`;
        const rows = await this.db.query<{ discord_id: string }>(sql);
        return rows.map(row => row.discord_id);
    }
}