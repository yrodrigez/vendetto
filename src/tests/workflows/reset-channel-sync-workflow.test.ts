import { ResetChannelSyncWorkflow } from "@/application/workflows/discord/reset-channel-sync/reset-channel-sync.workflow";

function createMocks() {
    const discordChannel = {
        createTextChannel: jest.fn().mockResolvedValue('channel-123'),
        addMemberToChannel: jest.fn().mockResolvedValue(undefined),
        deleteChannel: jest.fn().mockResolvedValue(undefined),
        sendMessage: jest.fn().mockResolvedValue(undefined),
        getChannelMembers: jest.fn().mockResolvedValue([]),
    };
    const resetChannelRepository = {
        findByResetId: jest.fn().mockResolvedValue(null),
        findAllActive: jest.fn().mockResolvedValue([]),
        findExpired: jest.fn().mockResolvedValue([]),
        insert: jest.fn().mockResolvedValue(undefined),
        deleteByResetId: jest.fn().mockResolvedValue(undefined),
    };
    const raidResetRepository = {
        findActiveResets: jest.fn().mockResolvedValue([]),
    };
    const participantRepository = {
        findSubscribedMembers: jest.fn().mockResolvedValue([]),
    };
    const logger = { log: jest.fn().mockResolvedValue(undefined) };
    const workflowExecutionRepository = {
        createExecution: jest.fn(),
        updateExecution: jest.fn(),
        createActivity: jest.fn(),
        updateActivity: jest.fn(),
    };
    const workflowRepository = {
        findByNameAndContext: jest.fn(),
        upsert: jest.fn(),
        updateNextExecution: jest.fn(),
        updateStatus: jest.fn(),
    };

    const discordApiPort = {
        findAllMembers: jest.fn().mockResolvedValue([]),
    };

    return {
        discordApiPort,
        discordChannel,
        resetChannelRepository,
        raidResetRepository,
        participantRepository,
        logger,
        workflowExecutionRepository,
        workflowRepository,
    };
}

function createWorkflow(mocks: ReturnType<typeof createMocks>) {
    const workflow = new ResetChannelSyncWorkflow(
        mocks.discordApiPort as any,
        mocks.discordChannel as any,
        mocks.resetChannelRepository as any,
        mocks.raidResetRepository as any,
        mocks.participantRepository as any,
        mocks.logger as any,
        mocks.workflowExecutionRepository as any,
        mocks.workflowRepository as any,
        'test-context',
    );

    (workflow as any).input = { guildId: 'guild-1' };

    return workflow;
}

describe('ResetChannelSyncWorkflow', () => {
    describe('createChannels', () => {
        test('creates a channel for each active reset without an existing channel', async () => {
            const mocks = createMocks();
            const workflow = createWorkflow(mocks);

            (workflow as any).activeResets = [
                { id: 'reset-1', raid: { name: 'Karazhan' }, raid_date: '2026-03-22', time: '20:00:00' },
                { id: 'reset-2', raid: { name: 'Gruul' }, raid_date: '2026-03-23', time: '20:00:00' },
            ];
            mocks.resetChannelRepository.findByResetId.mockResolvedValue(null);

            await (workflow as any).createChannels();

            expect(mocks.discordChannel.createTextChannel).toHaveBeenCalledTimes(2);
            expect(mocks.discordChannel.createTextChannel).toHaveBeenCalledWith(
                'guild-1',
                expect.objectContaining({
                    name: 'karazhan-22-mar-8pm',
                    categoryName: 'raids',
                    isPrivate: true,
                    topic: expect.stringContaining('Karazhan'),
                }),
            );
            expect(mocks.resetChannelRepository.insert).toHaveBeenCalledTimes(2);
        });

        test('skips creating channel when one already exists for a reset', async () => {
            const mocks = createMocks();
            const workflow = createWorkflow(mocks);

            (workflow as any).activeResets = [
                { id: 'reset-1', raid: { name: 'Karazhan' }, raid_date: '2026-03-22', time: '20:00:00' },
            ];
            mocks.resetChannelRepository.findByResetId.mockResolvedValue({
                reset_id: 'reset-1',
                channel_id: 'existing-channel',
                guild_id: 'guild-1',
            });

            await (workflow as any).createChannels();

            expect(mocks.discordChannel.createTextChannel).not.toHaveBeenCalled();
            expect(mocks.resetChannelRepository.insert).not.toHaveBeenCalled();
        });
    });

    describe('syncSubscribers', () => {
        test('adds missing members and sends Vendetto-style greeting with raid name and time', async () => {
            const mocks = createMocks();
            const workflow = createWorkflow(mocks);

            mocks.resetChannelRepository.findAllActive.mockResolvedValue([
                { id: 1, resetId: 'reset-1', channelId: 'channel-123', guildId: 'guild-1', raidName: 'Karazhan', raidDatetime: '2026-03-22T20:00:00' },
            ]);
            mocks.participantRepository.findSubscribedMembers.mockResolvedValue([
                { discordUserId: 'discord-1' },
                { discordUserId: 'discord-2' },
                { discordUserId: 'discord-3' },
            ]);
            mocks.discordChannel.getChannelMembers.mockResolvedValue(['discord-1']);
            mocks.discordApiPort.findAllMembers.mockResolvedValue([
                { id: 'discord-1' },
                { id: 'discord-2' },
                { id: 'discord-3' },
            ]);

            await (workflow as any).syncSubscribers();

            expect(mocks.discordChannel.addMemberToChannel).toHaveBeenCalledTimes(2);
            expect(mocks.discordChannel.addMemberToChannel).toHaveBeenCalledWith('channel-123', 'discord-2');
            expect(mocks.discordChannel.addMemberToChannel).toHaveBeenCalledWith('channel-123', 'discord-3');

            expect(mocks.discordChannel.sendMessage).toHaveBeenCalledTimes(2);
            expect(mocks.discordChannel.sendMessage).toHaveBeenCalledWith(
                'channel-123',
                expect.stringContaining('Karazhan'),
            );
            expect(mocks.discordChannel.sendMessage).toHaveBeenCalledWith(
                'channel-123',
                expect.stringContaining('discord-2'),
            );
        });

        test('skips members already in channel (idempotent)', async () => {
            const mocks = createMocks();
            const workflow = createWorkflow(mocks);

            mocks.resetChannelRepository.findAllActive.mockResolvedValue([
                { id: 1, resetId: 'reset-1', channelId: 'channel-123', guildId: 'guild-1', raidName: 'Karazhan', raidDatetime: '2026-03-22T20:00:00' },
            ]);
            mocks.participantRepository.findSubscribedMembers.mockResolvedValue([
                { discordUserId: 'discord-1' },
            ]);
            mocks.discordChannel.getChannelMembers.mockResolvedValue(['discord-1']);
            mocks.discordApiPort.findAllMembers.mockResolvedValue([
                { id: 'discord-1' },
            ]);

            await (workflow as any).syncSubscribers();

            expect(mocks.discordChannel.addMemberToChannel).not.toHaveBeenCalled();
        });

        test('skips subscribers not found in guild', async () => {
            const mocks = createMocks();
            const workflow = createWorkflow(mocks);

            mocks.resetChannelRepository.findAllActive.mockResolvedValue([
                { id: 1, resetId: 'reset-1', channelId: 'channel-123', guildId: 'guild-1', raidName: 'Karazhan', raidDatetime: '2026-03-22T20:00:00' },
            ]);
            mocks.participantRepository.findSubscribedMembers.mockResolvedValue([
                { discordUserId: 'discord-1' },
                { discordUserId: 'discord-unknown' },
            ]);
            mocks.discordChannel.getChannelMembers.mockResolvedValue([]);
            mocks.discordApiPort.findAllMembers.mockResolvedValue([
                { id: 'discord-1' },
            ]);

            await (workflow as any).syncSubscribers();

            expect(mocks.discordChannel.addMemberToChannel).toHaveBeenCalledTimes(1);
            expect(mocks.discordChannel.addMemberToChannel).toHaveBeenCalledWith('channel-123', 'discord-1');
            expect(mocks.discordChannel.addMemberToChannel).not.toHaveBeenCalledWith('channel-123', 'discord-unknown');
        });
    });

    describe('cleanupExpired', () => {
        test('deletes channel and DB row for expired resets', async () => {
            const mocks = createMocks();
            const workflow = createWorkflow(mocks);

            mocks.resetChannelRepository.findExpired.mockResolvedValue([
                { id: 1, resetId: 'reset-old', channelId: 'channel-old', guildId: 'guild-1' },
            ]);

            await (workflow as any).cleanupExpired();

            expect(mocks.discordChannel.deleteChannel).toHaveBeenCalledWith('channel-old');
            expect(mocks.resetChannelRepository.deleteByResetId).toHaveBeenCalledWith('reset-old');
        });

        test('handles multiple expired resets', async () => {
            const mocks = createMocks();
            const workflow = createWorkflow(mocks);

            mocks.resetChannelRepository.findExpired.mockResolvedValue([
                { id: 1, resetId: 'reset-old-1', channelId: 'channel-old-1', guildId: 'guild-1' },
                { id: 2, resetId: 'reset-old-2', channelId: 'channel-old-2', guildId: 'guild-1' },
            ]);

            await (workflow as any).cleanupExpired();

            expect(mocks.discordChannel.deleteChannel).toHaveBeenCalledTimes(2);
            expect(mocks.resetChannelRepository.deleteByResetId).toHaveBeenCalledTimes(2);
        });
    });

    describe('no active resets', () => {
        test('all steps are no-ops when no resets exist', async () => {
            const mocks = createMocks();
            const workflow = createWorkflow(mocks);

            (workflow as any).activeResets = [];
            mocks.resetChannelRepository.findAllActive.mockResolvedValue([]);
            mocks.resetChannelRepository.findExpired.mockResolvedValue([]);

            await (workflow as any).createChannels();
            await (workflow as any).syncSubscribers();
            await (workflow as any).cleanupExpired();

            expect(mocks.discordChannel.createTextChannel).not.toHaveBeenCalled();
            expect(mocks.discordChannel.addMemberToChannel).not.toHaveBeenCalled();
            expect(mocks.discordChannel.deleteChannel).not.toHaveBeenCalled();
        });
    });
});
