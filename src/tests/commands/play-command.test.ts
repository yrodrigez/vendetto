jest.mock('discord-player', () => ({}));
jest.mock('discord-player-youtubei', () => ({}));
jest.mock('@/infrastructure/discord/discord-api.adapter', () => ({
    getDiscordClient: jest.fn(),
}));

import { PlayCommand } from '@/application/commands/play.command';
import { MessageFlags } from 'discord.js';

function createMockPlayerAdapter() {
    return {
        play: jest.fn().mockResolvedValue({
            track: { title: 'Test Song', url: 'https://youtube.com/watch?v=test' },
            addedToQueue: false,
        }),
        skip: jest.fn(),
        stop: jest.fn(),
        getQueue: jest.fn(),
    };
}

function createMockInteraction(overrides: any = {}) {
    return {
        member: {
            voice: { channel: overrides.voiceChannel ?? null },
        },
        guildId: overrides.guildId ?? 'guild-1',
        options: {
            getString: jest.fn().mockReturnValue(overrides.query ?? 'Test Query'),
        },
        reply: jest.fn().mockResolvedValue(undefined),
        deferReply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
    } as any;
}

describe('PlayCommand', () => {
    test('replies ephemeral error when user is not in a voice channel', async () => {
        const adapter = createMockPlayerAdapter();
        const command = new PlayCommand(adapter as any);
        const interaction = createMockInteraction({ voiceChannel: null });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'You must be in a voice channel.',
            flags: MessageFlags.Ephemeral,
        });
        expect(adapter.play).not.toHaveBeenCalled();
    });

    test('defers reply and responds with "Now playing" for new playback', async () => {
        const adapter = createMockPlayerAdapter();
        const voiceChannel = { id: 'vc-1', guildId: 'guild-1' };
        const command = new PlayCommand(adapter as any);
        const interaction = createMockInteraction({ voiceChannel, query: 'Never Gonna Give You Up' });

        await command.execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(adapter.play).toHaveBeenCalledWith(voiceChannel, 'Never Gonna Give You Up');
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Now playing'),
            })
        );
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Test Song'),
            })
        );
    });

    test('responds with "Added to queue" when already playing', async () => {
        const adapter = createMockPlayerAdapter();
        adapter.play.mockResolvedValue({
            track: { title: 'Queued Song', url: 'https://youtube.com/watch?v=queued' },
            addedToQueue: true,
        });
        const voiceChannel = { id: 'vc-1', guildId: 'guild-1' };
        const command = new PlayCommand(adapter as any);
        const interaction = createMockInteraction({ voiceChannel });

        await command.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Added to queue'),
            })
        );
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Queued Song'),
            })
        );
    });

    test('responds with error message when adapter throws', async () => {
        const adapter = createMockPlayerAdapter();
        adapter.play.mockRejectedValue(new Error('No results found'));
        const voiceChannel = { id: 'vc-1', guildId: 'guild-1' };
        const command = new PlayCommand(adapter as any);
        const interaction = createMockInteraction({ voiceChannel });

        await command.execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Error playing track: No results found'),
            })
        );
    });
});
