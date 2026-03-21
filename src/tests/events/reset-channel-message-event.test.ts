import { ResetChannelMessageEvent } from "@/infrastructure/discord/events/reset-channel-message.event";

function createMocks() {
    const resetChannelRepository = {
        findByChannelId: jest.fn().mockResolvedValue(null),
    };
    const resetMessagesRepository = {
        insert: jest.fn().mockResolvedValue(undefined),
    };
    const databaseClient = {
        query: jest.fn().mockResolvedValue([]),
    };

    return { resetChannelRepository, resetMessagesRepository, databaseClient };
}

function createMessage(overrides: Partial<{
    channelId: string;
    authorId: string;
    authorBot: boolean;
    content: string;
}> = {}) {
    return {
        channel: { id: overrides.channelId ?? 'channel-123' },
        author: {
            id: overrides.authorId ?? 'discord-user-1',
            bot: overrides.authorBot ?? false,
        },
        content: overrides.content ?? 'Hello raiders!',
    };
}

describe('ResetChannelMessageEvent', () => {
    test('inserts message into reset_messages when channel is tracked', async () => {
        const mocks = createMocks();
        const event = new ResetChannelMessageEvent(
            mocks.resetChannelRepository as any,
            mocks.resetMessagesRepository as any,
            mocks.databaseClient as any,
        );

        mocks.resetChannelRepository.findByChannelId.mockResolvedValue({
            id: 1,
            resetId: 'reset-1',
            channelId: 'channel-123',
            guildId: 'guild-1',
        });
        mocks.databaseClient.query.mockResolvedValue([{ id: 42 }]);

        await event.execute(createMessage() as any);

        expect(mocks.resetMessagesRepository.insert).toHaveBeenCalledWith({
            resetId: 'reset-1',
            characterId: 42,
            content: 'Hello raiders!',
            source: 'discord',
        });
    });

    test('ignores messages in untracked channels', async () => {
        const mocks = createMocks();
        const event = new ResetChannelMessageEvent(
            mocks.resetChannelRepository as any,
            mocks.resetMessagesRepository as any,
            mocks.databaseClient as any,
        );

        mocks.resetChannelRepository.findByChannelId.mockResolvedValue(null);

        await event.execute(createMessage({ channelId: 'random-channel' }) as any);

        expect(mocks.resetMessagesRepository.insert).not.toHaveBeenCalled();
    });

    test('ignores bot messages to prevent echo loops', async () => {
        const mocks = createMocks();
        const event = new ResetChannelMessageEvent(
            mocks.resetChannelRepository as any,
            mocks.resetMessagesRepository as any,
            mocks.databaseClient as any,
        );

        await event.execute(createMessage({ authorBot: true }) as any);

        expect(mocks.resetChannelRepository.findByChannelId).not.toHaveBeenCalled();
        expect(mocks.resetMessagesRepository.insert).not.toHaveBeenCalled();
    });

    test('resolves discord user to selected ev_member via oauth_providers', async () => {
        const mocks = createMocks();
        const event = new ResetChannelMessageEvent(
            mocks.resetChannelRepository as any,
            mocks.resetMessagesRepository as any,
            mocks.databaseClient as any,
        );

        mocks.resetChannelRepository.findByChannelId.mockResolvedValue({
            id: 1,
            resetId: 'reset-1',
            channelId: 'channel-123',
            guildId: 'guild-1',
        });
        mocks.databaseClient.query.mockResolvedValue([{ id: 77 }]);

        await event.execute(createMessage({ authorId: 'discord-user-99' }) as any);

        expect(mocks.databaseClient.query).toHaveBeenCalledWith(
            expect.stringContaining('oauth_providers'),
            ['discord-user-99'],
        );
        expect(mocks.resetMessagesRepository.insert).toHaveBeenCalledWith(
            expect.objectContaining({ characterId: 77 }),
        );
    });

    test('skips insert when no selected member found for discord user', async () => {
        const mocks = createMocks();
        const event = new ResetChannelMessageEvent(
            mocks.resetChannelRepository as any,
            mocks.resetMessagesRepository as any,
            mocks.databaseClient as any,
        );

        mocks.resetChannelRepository.findByChannelId.mockResolvedValue({
            id: 1,
            resetId: 'reset-1',
            channelId: 'channel-123',
            guildId: 'guild-1',
        });
        mocks.databaseClient.query.mockResolvedValue([]);

        await event.execute(createMessage() as any);

        expect(mocks.resetMessagesRepository.insert).not.toHaveBeenCalled();
    });
});
