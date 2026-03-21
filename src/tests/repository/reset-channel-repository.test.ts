import { ResetChannelRepository } from "@/infrastructure/persistance/repositories/reset-channel/reset-channel.repository";
import { DatabaseClient } from "@/infrastructure/database/db";

function createMockClient(rows: any[] = []) {
    return {
        query: jest.fn().mockResolvedValue(rows),
        pool: {} as any,
    } as unknown as DatabaseClient;
}

describe('ResetChannelRepository', () => {
    test('findByResetId returns channel record when found', async () => {
        const client = createMockClient([
            { id: 1, reset_id: 'reset-1', channel_id: 'channel-123', guild_id: 'guild-1', created_at: '2026-03-22T10:00:00Z' },
        ]);
        const repo = new ResetChannelRepository(client);

        const result = await repo.findByResetId('reset-1');

        expect(result).toEqual({
            id: 1,
            resetId: 'reset-1',
            channelId: 'channel-123',
            guildId: 'guild-1',
        });
        expect((client as any).query).toHaveBeenCalledWith(
            expect.any(String),
            ['reset-1'],
        );
    });

    test('findByResetId returns null when not found', async () => {
        const client = createMockClient([]);
        const repo = new ResetChannelRepository(client);

        const result = await repo.findByResetId('nonexistent');

        expect(result).toBeNull();
    });

    test('findByChannelId returns channel record when found', async () => {
        const client = createMockClient([
            { id: 1, reset_id: 'reset-1', channel_id: 'channel-123', guild_id: 'guild-1' },
        ]);
        const repo = new ResetChannelRepository(client);

        const result = await repo.findByChannelId('channel-123');

        expect(result).toEqual({
            id: 1,
            resetId: 'reset-1',
            channelId: 'channel-123',
            guildId: 'guild-1',
        });
    });

    test('findByChannelId returns null when not found', async () => {
        const client = createMockClient([]);
        const repo = new ResetChannelRepository(client);

        const result = await repo.findByChannelId('nonexistent');

        expect(result).toBeNull();
    });

    test('findAllActive returns mapped channel records', async () => {
        const client = createMockClient([
            { id: 1, reset_id: 'reset-1', channel_id: 'ch-1', guild_id: 'guild-1' },
            { id: 2, reset_id: 'reset-2', channel_id: 'ch-2', guild_id: 'guild-1' },
        ]);
        const repo = new ResetChannelRepository(client);

        const results = await repo.findAllActive();

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({
            id: 1,
            resetId: 'reset-1',
            channelId: 'ch-1',
            guildId: 'guild-1',
        });
    });

    test('findExpired returns channels for resets past end_date + end_time + 8h', async () => {
        const client = createMockClient([
            { id: 1, reset_id: 'reset-old', channel_id: 'ch-old', guild_id: 'guild-1' },
        ]);
        const repo = new ResetChannelRepository(client);

        const results = await repo.findExpired();

        expect(results).toHaveLength(1);
        expect(results[0].resetId).toBe('reset-old');
    });

    test('insert creates a new channel mapping', async () => {
        const client = createMockClient([{ id: 1 }]);
        const repo = new ResetChannelRepository(client);

        await repo.insert({ resetId: 'reset-1', channelId: 'channel-123', guildId: 'guild-1' });

        expect((client as any).query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT'),
            ['reset-1', 'channel-123', 'guild-1'],
        );
    });

    test('deleteByResetId removes the channel mapping', async () => {
        const client = createMockClient([]);
        const repo = new ResetChannelRepository(client);

        await repo.deleteByResetId('reset-1');

        expect((client as any).query).toHaveBeenCalledWith(
            expect.stringContaining('DELETE'),
            ['reset-1'],
        );
    });
});
