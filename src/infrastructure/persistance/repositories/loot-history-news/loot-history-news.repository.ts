import { type DatabaseClient } from "@/infrastructure/database/db";
import {
    LootHistoryRepositoryPort,
    WeeklyLootEntry,
    WeeklyRaidReset
} from "@/application/ports/outbound/database/loot-history-repository.port";
import { readResourceFile } from "@/util/file-resource-helper";

type WeeklyRaidResetRow = {
    reset_id: string;
    raid_name: string;
    raid_date: Date;
    raid_time: string;
    raid_datetime: Date;
    status: string | null;
};

type WeeklyLootEntryRow = WeeklyRaidResetRow & {
    character_name: string;
    item_name: string;
    looted_at: Date;
};

export class LootHistoryRepository implements LootHistoryRepositoryPort {
    constructor(private readonly databaseClient: DatabaseClient) { }

    async findRaidResetsSince(since: Date): Promise<WeeklyRaidReset[]> {
        const query = readResourceFile(__dirname, 'sql/find-weekly-raid-resets.sql');
        const rows = await this.databaseClient.query<WeeklyRaidResetRow>(query, [since]);

        return rows.map(row => ({
            resetId: row.reset_id,
            raidName: row.raid_name,
            raidDate: row.raid_date,
            raidTime: row.raid_time,
            raidDatetime: row.raid_datetime,
            status: row.status,
        }));
    }

    async findLootHistorySince(since: Date): Promise<WeeklyLootEntry[]> {
        const query = readResourceFile(__dirname, 'sql/find-weekly-loot-history.sql');
        const rows = await this.databaseClient.query<WeeklyLootEntryRow>(query, [since]);

        return rows.map(row => ({
            resetId: row.reset_id,
            raidName: row.raid_name,
            raidDate: row.raid_date,
            raidTime: row.raid_time,
            raidDatetime: row.raid_datetime,
            characterName: row.character_name,
            itemName: row.item_name,
            lootedAt: row.looted_at,
        }));
    }
}
