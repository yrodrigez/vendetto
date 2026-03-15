import { readResourceFile } from "@/util/file-resource-helper"

import {
    IRaidReminderCandidateRepositoryPort,
    RaidReminderCandidate
} from "@/application/ports/outbound/raid-reminder-candidate-repository.port";
import { DatabaseClient } from "@/infrastructure/database/db";

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
    constructor(private databaseClient: DatabaseClient) { }

    async findAll({ communicationCode, }: { communicationCode: string } = {
        communicationCode: 'raidReminder',
    }) {
        const query = readResourceFile(__dirname, '/sql/find-candidates-for-raid-reminder.sql');
        const results = await this.databaseClient.query(query, [communicationCode]);
        return results.map(raidReminderCandidateMapper);
    }
}