jest.mock('discord-player', () => ({}));
jest.mock('discord-player-youtubei', () => ({}));
jest.mock('@/infrastructure/discord/discord-api.adapter', () => ({
    getDiscordClient: jest.fn(),
}));

import { VolumeCommand } from '@/application/commands/volume.command';
import { MessageFlags } from 'discord.js';

function createMockInteraction(volume: number | null = 50, guildId = 'guild-1') {
    return {
        guildId,
        options: {
            getInteger: jest.fn().mockReturnValue(volume),
        },
        reply: jest.fn().mockResolvedValue(undefined),
    } as any;
}

describe('VolumeCommand', () => {
    test('sets volume and confirms when value is provided', async () => {
        const adapter = {
            setVolume: jest.fn().mockReturnValue(true),
            getVolume: jest.fn().mockReturnValue(80),
        };
        const command = new VolumeCommand(adapter as any);
        const interaction = createMockInteraction(50);

        await command.execute(interaction);

        expect(adapter.setVolume).toHaveBeenCalledWith('guild-1', 50);
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Volume set to **50%**.',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('shows current volume when no value is provided', async () => {
        const adapter = {
            setVolume: jest.fn(),
            getVolume: jest.fn().mockReturnValue(80),
        };
        const command = new VolumeCommand(adapter as any);
        const interaction = createMockInteraction(null);

        await command.execute(interaction);

        expect(adapter.setVolume).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Current volume: **80%**.',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('replies nothing playing when no queue exists', async () => {
        const adapter = {
            setVolume: jest.fn().mockReturnValue(false),
            getVolume: jest.fn().mockReturnValue(null),
        };
        const command = new VolumeCommand(adapter as any);
        const interaction = createMockInteraction(50);

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Nothing is currently playing.',
            flags: MessageFlags.Ephemeral,
        });
    });
});
