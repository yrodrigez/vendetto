import { RaidReminderWorkflow } from "../../application/workflows/discord/raid-reminder/raid-reminder.workflow";
import { RaidReminderCandidate } from "@/application/ports/outbound/raid-reminder-candidate-repository.port";

function createMocks() {
    const candidateRepository = { findAll: jest.fn() };
    const processDeliveryUseCase = {
        execute: jest.fn().mockResolvedValue({ successful: [{ id: '1' }], failed: [] }),
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
        findDeliveryByName: jest.fn().mockResolvedValue({ id: 42, name: 'raidReminder' }),
    };

    return {
        candidateRepository,
        processDeliveryUseCase,
        logger,
        workflowExecutionRepository,
        workflowRepository,
        deliveryRepository,
    };
}

function createWorkflow(mocks: ReturnType<typeof createMocks>) {
    const workflow = new RaidReminderWorkflow(
        mocks.candidateRepository as any,
        mocks.processDeliveryUseCase as any,
        mocks.logger as any,
        mocks.workflowExecutionRepository as any,
        mocks.workflowRepository as any,
        'test-context',
        mocks.deliveryRepository as any,
    );

    // Set the input (normally set by execute())
    (workflow as any).input = { seedList: ['seed-user'], guildId: 'guild-1' };

    return workflow;
}

function candidate(overrides: Partial<RaidReminderCandidate> = {}): RaidReminderCandidate {
    return {
        characterName: 'Thrall',
        discordUserId: 'discord-1',
        raidDate: '2026-03-22T20:00:00Z',
        raidName: 'Karazhan',
        raidId: 'reset-kara',
        ...overrides,
    };
}

describe('RaidReminderWorkflow – processDelivery grouping', () => {
    test('single raid group: one execute() call with correct communicationCode', async () => {
        const mocks = createMocks();
        const workflow = createWorkflow(mocks);

        (workflow as any).candidatesData = [
            candidate({ discordUserId: 'discord-1', raidId: 'reset-kara', raidName: 'Karazhan' }),
            candidate({ discordUserId: 'discord-2', raidId: 'reset-kara', raidName: 'Karazhan', characterName: 'Jaina' }),
        ];

        await (workflow as any).processDelivery();

        expect(mocks.processDeliveryUseCase.execute).toHaveBeenCalledTimes(1);
        expect(mocks.processDeliveryUseCase.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.objectContaining({
                    communicationCode: 'raidReminder_reset-kara',
                }),
            }),
        );
    });

    test('multiple raid groups: one execute() call per raidId with correct communicationCode', async () => {
        const mocks = createMocks();
        const workflow = createWorkflow(mocks);

        (workflow as any).candidatesData = [
            candidate({ discordUserId: 'discord-1', raidId: 'reset-kara', raidName: 'Karazhan' }),
            candidate({ discordUserId: 'discord-2', raidId: 'reset-gruul', raidName: 'Gruul', characterName: 'Jaina' }),
            candidate({ discordUserId: 'discord-3', raidId: 'reset-kara', raidName: 'Karazhan', characterName: 'Arthas' }),
        ];

        await (workflow as any).processDelivery();

        // Should be called twice: once for Karazhan group, once for Gruul group
        expect(mocks.processDeliveryUseCase.execute).toHaveBeenCalledTimes(2);

        const calls = mocks.processDeliveryUseCase.execute.mock.calls;
        const commCodes = calls.map((c: any) => c[0].message.communicationCode).sort();
        expect(commCodes).toEqual(['raidReminder_reset-gruul', 'raidReminder_reset-kara']);
    });

    test('empty candidates: logs message, no execute() calls', async () => {
        const mocks = createMocks();
        const workflow = createWorkflow(mocks);

        (workflow as any).candidatesData = [];

        await (workflow as any).processDelivery();

        expect(mocks.processDeliveryUseCase.execute).not.toHaveBeenCalled();
        expect(mocks.logger.log).toHaveBeenCalledWith('guild-1', 'No members to notify for raid reminder');
    });

    test('each group targetData contains only candidates for that raid', async () => {
        const mocks = createMocks();
        const workflow = createWorkflow(mocks);

        (workflow as any).candidatesData = [
            candidate({ discordUserId: 'discord-1', raidId: 'reset-kara', raidName: 'Karazhan', characterName: 'Thrall' }),
            candidate({ discordUserId: 'discord-2', raidId: 'reset-gruul', raidName: 'Gruul', characterName: 'Jaina' }),
        ];

        await (workflow as any).processDelivery();

        const calls = mocks.processDeliveryUseCase.execute.mock.calls;

        for (const call of calls) {
            const { targetData, message } = call[0];
            const commCode: string = message.communicationCode;

            if (commCode === 'raidReminder_reset-kara') {
                expect(targetData).toHaveLength(1);
                expect(targetData[0].discordId).toBe('discord-1');
                expect(targetData[0].raidName).toBe('Karazhan');
            } else if (commCode === 'raidReminder_reset-gruul') {
                expect(targetData).toHaveLength(1);
                expect(targetData[0].discordId).toBe('discord-2');
                expect(targetData[0].raidName).toBe('Gruul');
            }
        }
    });
});
