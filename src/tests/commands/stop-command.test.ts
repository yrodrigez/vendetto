jest.mock('discord-player', () => ({}));
jest.mock('discord-player-youtubei', () => ({}));
jest.mock('@/infrastructure/discord/discord-api.adapter', () => ({
    getDiscordClient: jest.fn(),
}));

import { StopCommand } from '@/application/commands/stop.command';
import { MessageFlags } from 'discord.js';

function createMockPlayerAdapter(stopResult: boolean) {
    return {
        play: jest.fn(),
        skip: jest.fn(),
        stop: jest.fn().mockReturnValue(stopResult),
        getQueue: jest.fn(),
    };
}

function createMockInteraction(guildId = 'guild-1') {
    return {
        guildId,
        reply: jest.fn().mockResolvedValue(undefined),
    } as any;
}

describe('StopCommand', () => {
    test('replies "Stopped playback." when stop succeeds', async () => {
        const adapter = createMockPlayerAdapter(true);
        const command = new StopCommand(adapter as any);
        const interaction = createMockInteraction();

        await command.execute(interaction);

        expect(adapter.stop).toHaveBeenCalledWith('guild-1');
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Stopped playback.',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('replies "Nothing is currently playing." when no queue', async () => {
        const adapter = createMockPlayerAdapter(false);
        const command = new StopCommand(adapter as any);
        const interaction = createMockInteraction();

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Nothing is currently playing.',
            flags: MessageFlags.Ephemeral,
        });
    });
});
