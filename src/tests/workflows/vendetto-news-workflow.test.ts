import { VendettoNewsWorkflow } from "@/application/workflows/discord/vendetto-news/vendetto-news.workflow";

function createMocks() {
    const lootHistoryRepository = {
        findRaidResetsSince: jest.fn().mockResolvedValue([]),
        findLootHistorySince: jest.fn().mockResolvedValue([]),
    };
    const discordChannel = {
        findTextChannelByName: jest.fn(),
        findRecentMessages: jest.fn().mockResolvedValue([]),
        sendMessage: jest.fn().mockResolvedValue(undefined),
    };
    const newsDigestGeneration = {
        generateDigest: jest.fn().mockResolvedValue('**Vendetto News**\nLoot happened. Somehow.'),
    };
    const workflowExecutionRepository = {};
    const workflowRepository = {};

    discordChannel.findTextChannelByName.mockImplementation((_guildId: string, channelName: string) => {
        if (channelName === 'news') return Promise.resolve('news-channel');
        if (channelName === 'vendetto-news') return Promise.resolve('vendetto-news-channel');
        return Promise.resolve(null);
    });

    return {
        lootHistoryRepository,
        discordChannel,
        newsDigestGeneration,
        workflowExecutionRepository,
        workflowRepository,
    };
}

function createWorkflow(mocks: ReturnType<typeof createMocks>) {
    const workflow = new VendettoNewsWorkflow(
        mocks.lootHistoryRepository,
        mocks.discordChannel,
        mocks.newsDigestGeneration,
        mocks.workflowExecutionRepository as any,
        mocks.workflowRepository as any,
        'guild-1',
    );

    (workflow as any).input = { guildId: 'guild-1', guildName: 'Everlasting Vendetta' };

    return workflow;
}

describe('VendettoNewsWorkflow', () => {
    test('skips digest generation and posting when there is no weekly data', async () => {
        const mocks = createMocks();
        const workflow = createWorkflow(mocks);

        await (workflow as any).fetchWeeklyRaidAndLootData();
        await (workflow as any).fetchWeeklyNewsMessages();
        await (workflow as any).generateNewsDigest();
        await (workflow as any).publishNewsDigest();

        expect(mocks.newsDigestGeneration.generateDigest).not.toHaveBeenCalled();
        expect(mocks.discordChannel.sendMessage).not.toHaveBeenCalled();
    });

    test('reads exact news channel and posts generated markdown to exact vendetto-news channel', async () => {
        const mocks = createMocks();
        const workflow = createWorkflow(mocks);
        const raidReset = {
            resetId: 'reset-1',
            raidName: 'Karazhan',
            raidDate: new Date('2026-05-19T00:00:00Z'),
            raidTime: '20:00:00',
            raidDatetime: new Date('2026-05-19T20:00:00Z'),
            status: 'locked',
        };
        const loot = {
            ...raidReset,
            characterName: 'Guldanish',
            itemName: 'Very Ethical Dagger',
            lootedAt: new Date('2026-05-19T21:00:00Z'),
        };
        const newsMessage = {
            id: 'message-1',
            authorName: 'Wowhead',
            content: 'Patch notes arrived to ruin your addons.',
            createdAt: new Date('2026-05-20T10:00:00Z'),
            url: 'https://discord.com/channels/guild-1/news-channel/message-1',
        };

        mocks.lootHistoryRepository.findRaidResetsSince.mockResolvedValue([raidReset]);
        mocks.lootHistoryRepository.findLootHistorySince.mockResolvedValue([loot]);
        mocks.discordChannel.findRecentMessages.mockResolvedValue([newsMessage]);

        await (workflow as any).fetchWeeklyRaidAndLootData();
        await (workflow as any).fetchWeeklyNewsMessages();
        await (workflow as any).generateNewsDigest();
        await (workflow as any).publishNewsDigest();

        expect(mocks.discordChannel.findTextChannelByName).toHaveBeenCalledWith('guild-1', 'news');
        expect(mocks.discordChannel.findTextChannelByName).toHaveBeenCalledWith('guild-1', 'vendetto-news');
        expect(mocks.discordChannel.findRecentMessages).toHaveBeenCalledWith('news-channel', expect.any(Date));
        expect(mocks.newsDigestGeneration.generateDigest).toHaveBeenCalledWith(expect.objectContaining({
            guildName: 'Everlasting Vendetta',
            raidResets: [raidReset],
            lootHistory: [loot],
            newsMessages: [newsMessage],
        }));
        expect(mocks.discordChannel.sendMessage).toHaveBeenCalledWith(
            'vendetto-news-channel',
            '**Vendetto News**\nLoot happened. Somehow.',
        );
    });

    test('skips posting when digest generation fails', async () => {
        const mocks = createMocks();
        const workflow = createWorkflow(mocks);

        mocks.lootHistoryRepository.findRaidResetsSince.mockResolvedValue([
            {
                resetId: 'reset-1',
                raidName: 'Karazhan',
                raidDate: new Date('2026-05-19T00:00:00Z'),
                raidTime: '20:00:00',
                raidDatetime: new Date('2026-05-19T20:00:00Z'),
                status: 'locked',
            },
        ]);
        mocks.newsDigestGeneration.generateDigest.mockResolvedValue(null);

        await (workflow as any).fetchWeeklyRaidAndLootData();
        await (workflow as any).fetchWeeklyNewsMessages();
        await (workflow as any).generateNewsDigest();
        await (workflow as any).publishNewsDigest();

        expect(mocks.newsDigestGeneration.generateDigest).toHaveBeenCalledTimes(1);
        expect(mocks.discordChannel.sendMessage).not.toHaveBeenCalled();
    });
});
