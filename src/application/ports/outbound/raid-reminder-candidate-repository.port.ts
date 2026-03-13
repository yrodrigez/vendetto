export type RaidReminderCandidate = {
    memberId: string
    characterName: string
    discordUserId: string
    raidDate: string
    raidName: string
    raidId: string
}

export interface IRaidReminderCandidateRepositoryPort {
    findAll(params?: {
        activeFrom: string,
        alreadyNotifiedCode: string,
        alreadyNotifiedDelay: string,
        timezone: string
    }): Promise<RaidReminderCandidate[]>;
}
