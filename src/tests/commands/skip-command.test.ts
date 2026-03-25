jest.mock('discord-player', () => ({}));
jest.mock('discord-player-youtubei', () => ({}));
jest.mock('@/infrastructure/discord/discord-api.adapter', () => ({
    getDiscordClient: jest.fn(),
}));

import { SkipCommand } from '@/application/commands/skip.command';
import { MessageFlags } from 'discord.js';

function createMockPlayerAdapter(skipResult: boolean) {
    return {
        play: jest.fn(),
        skip: jest.fn().mockReturnValue(skipResult),
        stop: jest.fn(),
        getQueue: jest.fn(),
    };
}

function createMockInteraction(guildId = 'guild-1') {
    return {
        guildId,
        reply: jest.fn().mockResolvedValue(undefined),
    } as any;
}

describe('SkipCommand', () => {
    test('replies "Skipped!" when skip succeeds', async () => {
        const adapter = createMockPlayerAdapter(true);
        const command = new SkipCommand(adapter as any);
        const interaction = createMockInteraction();

        await command.execute(interaction);

        expect(adapter.skip).toHaveBeenCalledWith('guild-1');
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Skipped!',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('replies "Nothing is currently playing." when no queue', async () => {
        const adapter = createMockPlayerAdapter(false);
        const command = new SkipCommand(adapter as any);
        const interaction = createMockInteraction();

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Nothing is currently playing.',
            flags: MessageFlags.Ephemeral,
        });
    });
});
