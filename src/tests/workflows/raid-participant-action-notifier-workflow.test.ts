import { RaidParticipantActionEvent } from "@/application/ports/outbound/database/raid-participant-action-events-repository.port";
import { RaidParticipantActionNotifierWorkflow } from "@/application/workflows/discord/raid-participant-action-notifier/raid-participant-action-notifier.workflow";

function createMocks() {
    const eventsRepository = {
        findRecentEvents: jest.fn().mockResolvedValue([]),
    };
    const processDeliveryUseCase = {
        execute: jest.fn().mockResolvedValue({ successful: ['1'], failed: [] }),
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
    const deliveryRepository = {
        findDeliveryByName: jest.fn().mockResolvedValue({ id: 88, name: 'admin_action' }),
    };

    return {
        eventsRepository,
        processDeliveryUseCase,
        logger,
        workflowExecutionRepository,
        workflowRepository,
        deliveryRepository,
    };
}

function createWorkflow(mocks: ReturnType<typeof createMocks>) {
    const workflow = new RaidParticipantActionNotifierWorkflow(
        mocks.eventsRepository as any,
        mocks.processDeliveryUseCase as any,
        mocks.logger as any,
        mocks.workflowExecutionRepository as any,
        mocks.workflowRepository as any,
        'guild-1',
        mocks.deliveryRepository as any,
    );

    (workflow as any).input = { guildId: 'guild-1' };
    return workflow;
}

function candidate(overrides: Partial<RaidParticipantActionEvent> = {}): RaidParticipantActionEvent {
    return {
        discordUserId: '123456789',
        memberId: 42,
        memberName: 'Thrall',
        eventName: 'raid_bench_player',
        createdAt: new Date('2026-04-21T08:00:00.000Z'),
        resetId: 'reset-1',
        raidName: 'Karazhan',
        raidDate: '2026-04-23 19:00:00',
        fromResetId: null,
        fromRaidName: null,
        fromRaidDate: null,
        toResetId: null,
        toRaidName: null,
        toRaidDate: null,
        ...overrides,
    };
}

describe('RaidParticipantActionNotifierWorkflow', () => {
    test('fetchEvents loads recent candidates from repository', async () => {
        const mocks = createMocks();
        const workflow = createWorkflow(mocks);
        mocks.eventsRepository.findRecentEvents.mockResolvedValue([candidate()]);

        await (workflow as any).fetchEvents();

        expect(mocks.eventsRepository.findRecentEvents).toHaveBeenCalledWith(3600, 3600);
        expect((workflow as any).candidatesData).toHaveLength(1);
    });

    test('fetchEvents uses configured exclusion window when provided', async () => {
        const mocks = createMocks();
        const workflow = createWorkflow(mocks);
        mocks.eventsRepository.findRecentEvents.mockResolvedValue([candidate()]);

        await (workflow as any).fetchEvents();

        expect(mocks.eventsRepository.findRecentEvents).toHaveBeenCalledWith(3600, 3600);
    });

    test('processDelivery is a no-op when there are no candidates', async () => {
        const mocks = createMocks();
        const workflow = createWorkflow(mocks);
        (workflow as any).candidatesData = [];

        await (workflow as any).processDelivery();

        expect(mocks.deliveryRepository.findDeliveryByName).not.toHaveBeenCalled();
        expect(mocks.processDeliveryUseCase.execute).not.toHaveBeenCalled();
        expect(mocks.logger.log).not.toHaveBeenCalled();
    });

    test('processDelivery builds bench communication and logs summary', async () => {
        const mocks = createMocks();
        const workflow = createWorkflow(mocks);
        (workflow as any).candidatesData = [candidate()];

        await (workflow as any).processDelivery();

        expect(mocks.deliveryRepository.findDeliveryByName).toHaveBeenCalledWith('admin_action');
        expect(mocks.processDeliveryUseCase.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 88,
                target: [{ discordId: '123456789' }],
                message: expect.objectContaining({
                    communicationCode: 'raid_participant_action_notifier',
                }),
                targetData: [expect.objectContaining({
                    discordId: '123456789',
                    memberName: 'Thrall',
                    raidLinkResetId: 'reset-1',
                    actionDescription: expect.stringContaining('moved to the bench'),
                })],
            })
        );
        expect(mocks.logger.log).toHaveBeenCalledWith('guild-1', 'Delivery raid_participant_action_notifier: ok=1, fail=0');
    });

    test('processDelivery uses destination reset link for moved participants', async () => {
        const mocks = createMocks();
        const workflow = createWorkflow(mocks);
        (workflow as any).candidatesData = [candidate({
            eventName: 'move_participant',
            resetId: 'to-reset',
            fromResetId: 'from-reset',
            fromRaidName: 'Karazhan',
            fromRaidDate: '2026-04-22 19:00:00',
            toResetId: 'to-reset',
            toRaidName: 'Karazhan',
            toRaidDate: '2026-04-23 19:00:00',
        })];

        await (workflow as any).processDelivery();

        const payload = mocks.processDeliveryUseCase.execute.mock.calls[0][0];
        expect(payload.targetData[0].raidLinkResetId).toBe('to-reset');
        expect(payload.targetData[0].actionDescription).toContain('moved from');
        expect(payload.targetData[0].actionDescription).toContain('to');
    });

    test('processDelivery formats remove and unbench actions distinctly', async () => {
        const mocks = createMocks();
        const workflow = createWorkflow(mocks);
        (workflow as any).candidatesData = [
            candidate({ discordUserId: '111111111', eventName: 'raid_remove_player', resetId: 'remove-reset' }),
            candidate({ discordUserId: '222222222', eventName: 'raid_unbench_player', resetId: 'unbench-reset', memberName: 'Jaina' }),
        ];

        await (workflow as any).processDelivery();

        const payload = mocks.processDeliveryUseCase.execute.mock.calls[0][0];
        expect(payload.targetData[0].actionDescription).toContain('removed from');
        expect(payload.targetData[1].actionDescription).toContain('taken off the bench');
    });
});
