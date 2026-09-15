import { AnnounceCommand } from '@/application/commands/announce.command';
import { ChannelType, MessageFlags, PermissionFlagsBits } from 'discord.js';

function createMockInteraction(overrides: any = {}) {
    return {
        guildId: overrides.guildId !== undefined ? overrides.guildId : 'guild-1',
        user: {
            id: 'user-1',
            username: 'TestUser',
            displayAvatarURL: () => 'https://example.com/avatar.png',
        },
        memberPermissions: overrides.memberPermissions ?? {
            has: (flag: bigint) => flag === PermissionFlagsBits.Administrator,
        },
        options: {
            getChannel: jest.fn().mockReturnValue(overrides.channel ?? {
                id: 'channel-1',
                type: ChannelType.GuildText,
                send: jest.fn().mockResolvedValue(undefined),
            }),
            getString: jest.fn().mockReturnValue(overrides.message ?? 'Hello world'),
        },
        reply: jest.fn().mockResolvedValue(undefined),
    } as any;
}

describe('AnnounceCommand', () => {
    test('replies ephemeral error when used outside a guild', async () => {
        const command = new AnnounceCommand();
        const interaction = createMockInteraction({ guildId: null });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'This command can only be used in a server.',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('replies ephemeral error when user lacks admin permission', async () => {
        const command = new AnnounceCommand();
        const interaction = createMockInteraction({
            memberPermissions: { has: () => false },
        });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'You do not have permission to use this command.',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('replies ephemeral error when target channel is not text based', async () => {
        const command = new AnnounceCommand();
        const interaction = createMockInteraction({
            channel: { id: 'vc-1', type: ChannelType.GuildVoice, send: jest.fn() },
        });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'The selected channel must be a text or announcement channel.',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('sends embed to channel and confirms for an admin', async () => {
        const command = new AnnounceCommand();
        const send = jest.fn().mockResolvedValue(undefined);
        const channel = { id: 'channel-1', type: ChannelType.GuildText, send };
        const interaction = createMockInteraction({ channel, message: 'Server maintenance at 8pm' });

        await command.execute(interaction);

        expect(send).toHaveBeenCalledWith({
            embeds: [
                expect.objectContaining({
                    data: expect.objectContaining({
                        title: '📣 Announcement',
                        description: 'Server maintenance at 8pm',
                    }),
                }),
            ],
        });
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Announcement posted in <#channel-1>.',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('replies ephemeral error when sending fails', async () => {
        const command = new AnnounceCommand();
        const send = jest.fn().mockRejectedValue(new Error('Missing Permissions'));
        const channel = { id: 'channel-1', type: ChannelType.GuildText, send };
        const interaction = createMockInteraction({ channel });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Failed to send the announcement. Make sure the bot has permission to send messages in <#channel-1>.',
            flags: MessageFlags.Ephemeral,
        });
    });
});
