export type RaidSignupDto = {
    memberId: string;
    raidId: string;
    createdAt: Date;
    updatedAt: Date;
    status: string;
    role: string;
    raidDate: Date;
    time: string;
    raidName: string;
    characterName: string;
    characterClass: string;
};

export type RaidRoleCountsDto = {
    raidId: string;
    status: string;
    role: string;
    count: number;
};

export interface IRaidSignupNotifierRepositoryPort {
    findRecentSignups(timeWindowSeconds: number): Promise<RaidSignupDto[]>;
    findNotifiedTexts(communicationCode: string, timeWindowSeconds: number): Promise<string[]>;
    findRaidCounts(raidIds: string[]): Promise<RaidRoleCountsDto[]>;
}
