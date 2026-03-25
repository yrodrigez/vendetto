import { DatabaseClient } from "@/infrastructure/database/db";
import { readResourceFile } from "@/util/file-resource-helper";
import {
    IRaidSignupNotifierRepositoryPort,
    RaidRoleCountsDto,
    RaidSignupDto
} from "@/application/ports/outbound/database/raid-signup-notifier-repository.port";

type RaidSignupRow = {
    member_id: string;
    raid_id: string;
    created_at: Date;
    updated_at: Date;
    status: string;
    role: string;
    raid_date: Date;
    time: string;
    raid_name: string;
    character_name: string;
    character_class: string;
};

export class RaidSignupNotifierRepository implements IRaidSignupNotifierRepositoryPort {
    constructor(private readonly db: DatabaseClient) { }

    async findRecentSignups(timeWindowSeconds: number): Promise<RaidSignupDto[]> {
        const sql = readResourceFile(__dirname, 'sql/find-recent-signups.sql');
        const rows = await this.db.query<RaidSignupRow>(sql, [timeWindowSeconds]);
        return rows.map(row => ({
            memberId: row.member_id,
            raidId: row.raid_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            status: row.status,
            role: row.role,
            raidDate: row.raid_date,
            time: row.time,
            raidName: row.raid_name,
            characterName: row.character_name,
            characterClass: row.character_class
        }));
    }

    async findNotifiedTexts(communicationCode: string, timeWindowSeconds: number): Promise<string[]> {
        const sql = readResourceFile(__dirname, 'sql/find-notified-texts.sql');
        const rows = await this.db.query<{ notification_text: string }>(sql, [communicationCode, timeWindowSeconds]);
        return rows.map(row => row.notification_text);
    }

    async findRaidCounts(raidIds: string[]): Promise<RaidRoleCountsDto[]> {
        if (!raidIds.length) return [];
        const sql = readResourceFile(__dirname, 'sql/find-raid-counts.sql');
        const rows = await this.db.query<{ raid_id: string; status: string; role: string; count: string }>(sql, [raidIds]);
        return rows.map(row => ({
            raidId: row.raid_id,
            status: row.status,
            role: row.role,
            count: Number(row.count)
        }));
    }
}
