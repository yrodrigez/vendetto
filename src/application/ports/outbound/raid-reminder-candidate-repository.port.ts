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
        communicationCode: string,
    }): Promise<RaidReminderCandidate[]>;
}
