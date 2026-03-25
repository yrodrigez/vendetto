jest.mock('discord-player', () => ({
    Player: jest.fn(),
    GuildQueueEvent: {
        PlayerStart: 'playerStart',
        PlayerError: 'playerError',
    },
}));
jest.mock('discord-player-youtubei', () => ({
    YoutubeiExtractor: jest.fn(),
}));
jest.mock('@/infrastructure/discord/discord-api.adapter', () => ({
    getDiscordClient: jest.fn(),
}));

import { DiscordPlayerAdapter } from '@/infrastructure/discord/discord-player.adapter';

function createMockPlayer() {
    const mockQueue = {
        node: { skip: jest.fn().mockReturnValue(true) },
        delete: jest.fn(),
        currentTrack: { title: 'Test Song', url: 'https://youtube.com/watch?v=test' },
        tracks: { toArray: jest.fn().mockReturnValue([]) },
    };

    const nodes = {
        get: jest.fn().mockReturnValue(mockQueue),
    };

    const play = jest.fn().mockResolvedValue({
        track: { title: 'Test Song', url: 'https://youtube.com/watch?v=test' },
    });

    const events = { on: jest.fn() };
    const extractors = { register: jest.fn().mockResolvedValue(undefined) };

    return { player: { play, nodes, events, extractors }, mockQueue };
}

function createAdapter(player: any): DiscordPlayerAdapter {
    const adapter = new DiscordPlayerAdapter();
    (adapter as any).player = player;
    return adapter;
}

describe('DiscordPlayerAdapter', () => {
    test('play() delegates to player and returns track info with addedToQueue false when queue is new', async () => {
        const { player } = createMockPlayer();
        player.nodes.get.mockReturnValue(null);

        const adapter = createAdapter(player);
        const voiceChannel = { id: 'vc-1', guildId: 'guild-1' } as any;
        const result = await adapter.play(voiceChannel, 'Never Gonna Give You Up');

        expect(player.play).toHaveBeenCalledWith(
            voiceChannel,
            'Never Gonna Give You Up',
            expect.objectContaining({ nodeOptions: expect.any(Object) }),
        );
        expect(result).toEqual({
            track: { title: 'Test Song', url: 'https://youtube.com/watch?v=test' },
            addedToQueue: false,
        });
    });

    test('play() returns addedToQueue true when a queue already exists', async () => {
        const { player, mockQueue } = createMockPlayer();
        player.nodes.get.mockReturnValue(mockQueue);

        const adapter = createAdapter(player);
        const voiceChannel = { id: 'vc-1', guildId: 'guild-1' } as any;
        const result = await adapter.play(voiceChannel, 'Another Song');

        expect(result.addedToQueue).toBe(true);
    });

    test('skip() returns false when no queue exists for guild', () => {
        const { player } = createMockPlayer();
        player.nodes.get.mockReturnValue(null);

        const adapter = createAdapter(player);
        expect(adapter.skip('guild-1')).toBe(false);
    });

    test('skip() delegates to queue.node.skip() and returns true', () => {
        const { player, mockQueue } = createMockPlayer();

        const adapter = createAdapter(player);
        expect(adapter.skip('guild-1')).toBe(true);
        expect(mockQueue.node.skip).toHaveBeenCalled();
    });

    test('stop() returns false when no queue exists for guild', () => {
        const { player } = createMockPlayer();
        player.nodes.get.mockReturnValue(null);

        const adapter = createAdapter(player);
        expect(adapter.stop('guild-1')).toBe(false);
    });

    test('stop() deletes queue and returns true', () => {
        const { player, mockQueue } = createMockPlayer();

        const adapter = createAdapter(player);
        expect(adapter.stop('guild-1')).toBe(true);
        expect(mockQueue.delete).toHaveBeenCalled();
    });

    test('getQueue() returns current track and upcoming tracks', () => {
        const { player, mockQueue } = createMockPlayer();
        mockQueue.tracks.toArray.mockReturnValue([
            { title: 'Next Song', url: 'https://youtube.com/watch?v=next' },
        ]);

        const adapter = createAdapter(player);
        const result = adapter.getQueue('guild-1');

        expect(result).toEqual({
            current: { title: 'Test Song', url: 'https://youtube.com/watch?v=test' },
            tracks: [{ title: 'Next Song', url: 'https://youtube.com/watch?v=next' }],
        });
    });

    test('getQueue() returns null current and empty tracks when no queue', () => {
        const { player } = createMockPlayer();
        player.nodes.get.mockReturnValue(null);

        const adapter = createAdapter(player);
        const result = adapter.getQueue('guild-1');

        expect(result).toEqual({ current: null, tracks: [] });
    });
});
