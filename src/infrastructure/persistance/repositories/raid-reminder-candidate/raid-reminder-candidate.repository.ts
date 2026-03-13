import { readResourceFile } from "@/util/file-resource-helper"

import {
    IRaidReminderCandidateRepositoryPort,
    RaidReminderCandidate
} from "@/application/ports/outbound/raid-reminder-candidate-repository.port";

function raidReminderCandidateMapper(raidReminderCandidate: any): RaidReminderCandidate {
    return {
        memberId: raidReminderCandidate.memberId,
        characterName: raidReminderCandidate.characterName,
        discordUserId: raidReminderCandidate.discordUserId,
        raidDate: raidReminderCandidate.raidDate,
        raidName: raidReminderCandidate.raidName,
        raidId: raidReminderCandidate.raidId
    }
}
export class RaidReminderCandidateRepository implements IRaidReminderCandidateRepositoryPort {
    constructor(private databaseClient: any) { }

    async findAll({ activeFrom, alreadyNotifiedCode, alreadyNotifiedDelay, timezone }: { activeFrom: string, alreadyNotifiedCode: string, alreadyNotifiedDelay: string, timezone: string } = {
        activeFrom: '21 days',
        alreadyNotifiedCode: 'raidReminder',
        alreadyNotifiedDelay: '2 days',
        timezone: 'Europe/Madrid'
    }) {
        const query = readResourceFile(__dirname, '/raid-reminder-candidate.sql');
        const results = await this.databaseClient.query(query, [activeFrom, alreadyNotifiedCode, alreadyNotifiedDelay, timezone]);
        return results.map(raidReminderCandidateMapper);
    }
}