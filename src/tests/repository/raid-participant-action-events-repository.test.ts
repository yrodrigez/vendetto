import { DatabaseClient } from "@/infrastructure/database/db";
import { RaidParticipantWebEventsRepository } from "@/infrastructure/persistance/repositories/raid-participant-action-events/raid-participant-web-events.repository";


function createMockClient(rows: any[] = []) {
    return {
        query: jest.fn().mockResolvedValue(rows),
        pool: {} as any,
    } as unknown as DatabaseClient;
}

describe('RaidParticipantWebEventsRepository', () => {
    test('findRecentEvents passes time window as query parameter', async () => {
        const client = createMockClient([]);
        const repo = new RaidParticipantWebEventsRepository(client);

        await repo.findRecentEvents(3600);

        expect((client as any).query).toHaveBeenCalledWith(
            expect.any(String),
            [3600, 3600],
        );
    });

    test('query excludes users already notified in the last hour', async () => {
        const client = createMockClient([]);
        const repo = new RaidParticipantWebEventsRepository(client);

        await repo.findRecentEvents(3600);

        expect((client as any).query).toHaveBeenCalledWith(
            expect.stringContaining('open_campaign.broadlog'),
            [3600, 3600],
        );
        expect((client as any).query).toHaveBeenCalledWith(
            expect.stringContaining("bl.communication_code = 'raid_participant_action_notifier'"),
            [3600, 3600],
        );
    });

    test('findRecentEvents passes custom exclusion window when provided', async () => {
        const client = createMockClient([]);
        const repo = new RaidParticipantWebEventsRepository(client);

        await repo.findRecentEvents(3580, 7200);

        expect((client as any).query).toHaveBeenCalledWith(
            expect.any(String),
            [3580, 7200],
        );
    });

    test('maps move participant rows correctly', async () => {
        const client = createMockClient([
            {
                discord_user_id: '123456789',
                member_id: 42,
                member_name: 'Thrall',
                event_name: 'move_participant',
                created_at: new Date('2026-04-21T08:00:00.000Z'),
                reset_id: 'to-reset',
                raid_name: 'Karazhan',
                raid_date: '2026-04-23 19:00:00',
                from_reset_id: 'from-reset',
                from_raid_name: 'Karazhan',
                from_raid_date: '2026-04-22 19:00:00',
                to_reset_id: 'to-reset',
                to_raid_name: 'Karazhan',
                to_raid_date: '2026-04-23 19:00:00',
            },
        ]);
        const repo = new RaidParticipantWebEventsRepository(client);

        const results = await repo.findRecentEvents(3600);

        expect(results).toEqual([
            {
                discordUserId: '123456789',
                memberId: 42,
                memberName: 'Thrall',
                eventName: 'move_participant',
                createdAt: new Date('2026-04-21T08:00:00.000Z'),
                resetId: 'to-reset',
                raidName: 'Karazhan',
                raidDate: '2026-04-23 19:00:00',
                fromResetId: 'from-reset',
                fromRaidName: 'Karazhan',
                fromRaidDate: '2026-04-22 19:00:00',
                toResetId: 'to-reset',
                toRaidName: 'Karazhan',
                toRaidDate: '2026-04-23 19:00:00',
            },
        ]);
    });

    test('maps bench rows with nullable move fields', async () => {
        const client = createMockClient([
            {
                discord_user_id: '987654321',
                member_id: 84,
                member_name: 'Jaina',
                event_name: 'raid_bench_player',
                created_at: new Date('2026-04-21T09:00:00.000Z'),
                reset_id: 'bench-reset',
                raid_name: 'Gruul',
                raid_date: '2026-04-24 20:00:00',
                from_reset_id: null,
                from_raid_name: null,
                from_raid_date: null,
                to_reset_id: null,
                to_raid_name: null,
                to_raid_date: null,
            },
        ]);
        const repo = new RaidParticipantWebEventsRepository(client);

        const results = await repo.findRecentEvents(3600);

        expect(results[0]).toEqual({
            discordUserId: '987654321',
            memberId: 84,
            memberName: 'Jaina',
            eventName: 'raid_bench_player',
            createdAt: new Date('2026-04-21T09:00:00.000Z'),
            resetId: 'bench-reset',
            raidName: 'Gruul',
            raidDate: '2026-04-24 20:00:00',
            fromResetId: null,
            fromRaidName: null,
            fromRaidDate: null,
            toResetId: null,
            toRaidName: null,
            toRaidDate: null,
        });
    });
});
