export type WeeklyRaidReset = {
    resetId: string;
    raidName: string;
    raidDate: Date;
    raidTime: string;
    raidDatetime: Date;
    status: string | null;
};

export type WeeklyLootEntry = {
    resetId: string;
    raidName: string;
    raidDate: Date;
    raidTime: string;
    raidDatetime: Date;
    characterName: string;
    itemName: string;
    lootedAt: Date;
};

export interface LootHistoryRepositoryPort {
    findRaidResetsSince(since: Date): Promise<WeeklyRaidReset[]>;
    findLootHistorySince(since: Date): Promise<WeeklyLootEntry[]>;
}
