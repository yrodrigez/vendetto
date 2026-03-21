import { RaidReminderCandidateRepository } from "@/infrastructure/persistance/repositories/raid-reminder-candidate/raid-reminder-candidate.repository";
import { DatabaseClient } from "@/infrastructure/database/db";

function createMockClient(rows: any[] = []) {
    return {
        query: jest.fn().mockResolvedValue(rows),
        pool: {} as any,
    } as unknown as DatabaseClient;
}

describe('RaidReminderCandidateRepository', () => {
    test('findAll passes communicationCode as query parameter', async () => {
        const client = createMockClient([]);
        const repo = new RaidReminderCandidateRepository(client);

        await repo.findAll({ communicationCode: 'raidReminder' });

        expect((client as any).query).toHaveBeenCalledWith(
            expect.any(String),
            ['raidReminder'],
        );
    });

    test('mapper returns correct RaidReminderCandidate shape', async () => {
        const client = createMockClient([
            {
                discord_id: 'discord-1',
                name: 'Thrall',
                raid_date: '2026-03-22T20:00:00+01:00',
                raid_name: 'Karazhan',
                raid_id: 'reset-kara',
            },
        ]);
        const repo = new RaidReminderCandidateRepository(client);

        const results = await repo.findAll({ communicationCode: 'raidReminder' });

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
            characterName: 'Thrall',
            discordUserId: 'discord-1',
            raidDate: '2026-03-22T20:00:00+01:00',
            raidName: 'Karazhan',
            raidId: 'reset-kara',
        });
    });

    test('cascade: query returns different raids for different members', async () => {
        // Simulates the expected query output after rewrite:
        // Member A → Karazhan (not subscribed to nearest)
        // Member B → Gruul (subscribed to Karazhan, cascaded)
        const client = createMockClient([
            {
                discord_id: 'discord-10',
                name: 'Varian',
                raid_date: '2026-03-22T20:00:00+01:00',
                raid_name: 'Karazhan',
                raid_id: 'reset-kara',
            },
            {
                discord_id: 'discord-11',
                name: 'Garrosh',
                raid_date: '2026-03-23T20:00:00+01:00',
                raid_name: 'Gruul',
                raid_id: 'reset-gruul',
            },
        ]);
        const repo = new RaidReminderCandidateRepository(client);

        const results = await repo.findAll({ communicationCode: 'raidReminder' });

        expect(results).toHaveLength(2);

        const memberA = results.find(r => r.discordUserId === 'discord-10');
        const memberB = results.find(r => r.discordUserId === 'discord-11');

        expect(memberA!.raidName).toBe('Karazhan');
        expect(memberB!.raidName).toBe('Gruul');
    });

    test('empty results when all members are subscribed or excluded', async () => {
        const client = createMockClient([]);
        const repo = new RaidReminderCandidateRepository(client);

        const results = await repo.findAll({ communicationCode: 'raidReminder' });

        expect(results).toHaveLength(0);
    });

    test('maps multiple candidates with mixed raidIds', async () => {
        const client = createMockClient([
            { discord_id: 'd1', name: 'A', raid_date: '2026-03-22T20:00:00+01:00', raid_name: 'Karazhan', raid_id: 'r1' },
            { discord_id: 'd2', name: 'B', raid_date: '2026-03-22T20:00:00+01:00', raid_name: 'Karazhan', raid_id: 'r1' },
            { discord_id: 'd3', name: 'C', raid_date: '2026-03-23T20:00:00+01:00', raid_name: 'Gruul', raid_id: 'r2' },
        ]);
        const repo = new RaidReminderCandidateRepository(client);

        const results = await repo.findAll({ communicationCode: 'raidReminder' });

        expect(results).toHaveLength(3);
        expect(results.map(r => r.raidId)).toEqual(['r1', 'r1', 'r2']);
    });
});
