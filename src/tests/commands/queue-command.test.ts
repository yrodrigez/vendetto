jest.mock('discord-player', () => ({}));
jest.mock('discord-player-youtubei', () => ({}));
jest.mock('@/infrastructure/discord/discord-api.adapter', () => ({
    getDiscordClient: jest.fn(),
}));

import { QueueCommand } from '@/application/commands/queue.command';
import { MessageFlags } from 'discord.js';

function createMockInteraction(guildId = 'guild-1') {
    return {
        guildId,
        reply: jest.fn().mockResolvedValue(undefined),
    } as any;
}

describe('QueueCommand', () => {
    test('shows current track and upcoming tracks when queue has items', async () => {
        const adapter = {
            getQueue: jest.fn().mockReturnValue({
                current: { title: 'Current Song', url: 'https://youtube.com/watch?v=current' },
                tracks: [
                    { title: 'Next Song', url: 'https://youtube.com/watch?v=next' },
                    { title: 'After That', url: 'https://youtube.com/watch?v=after' },
                ],
            }),
        };
        const command = new QueueCommand(adapter as any);
        const interaction = createMockInteraction();

        await command.execute(interaction);

        const reply = interaction.reply.mock.calls[0][0].content as string;
        expect(reply).toContain('Current Song');
        expect(reply).toContain('Next Song');
        expect(reply).toContain('After That');
    });

    test('replies "Nothing is currently playing." when queue is empty', async () => {
        const adapter = {
            getQueue: jest.fn().mockReturnValue({ current: null, tracks: [] }),
        };
        const command = new QueueCommand(adapter as any);
        const interaction = createMockInteraction();

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Nothing is currently playing.',
            flags: MessageFlags.Ephemeral,
        });
    });
});
