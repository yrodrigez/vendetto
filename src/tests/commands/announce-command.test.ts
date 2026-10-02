import { AnnounceCommand } from '@/application/commands/announce.command';
import { ChannelType, MessageFlags, PermissionFlagsBits } from 'discord.js';

function textChannel(id: string, name: string, send = jest.fn().mockResolvedValue(undefined)) {
    return { id, name, type: ChannelType.GuildText, send };
}

function createMockInteraction(overrides: any = {}) {
    const guildChannels = overrides.guildChannels ?? [];
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
        channel: overrides.channel,
        guild: {
            channels: {
                fetch: jest.fn((id?: string) => {
                    if (id) {
                        return Promise.resolve(guildChannels.find((c: any) => c.id === id));
                    }
                    return Promise.resolve({ find: (fn: (c: any) => boolean) => guildChannels.find(fn) });
                }),
            },
        },
        options: {
            getString: jest.fn((name: string) => {
                if (name === 'title') return overrides.title ?? 'Default Title';
                if (name === 'message') return overrides.message ?? 'Hello world';
                return overrides.channelArg ?? null;
            }),
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
        const interaction = createMockInteraction({ memberPermissions: { has: () => false } });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'You do not have permission to use this command.',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('posts to current channel when channel option is empty', async () => {
        const command = new AnnounceCommand();
        const send = jest.fn().mockResolvedValue(undefined);
        const current = textChannel('current-1', 'general', send);
        const interaction = createMockInteraction({ channel: current });

        await command.execute(interaction);

        expect(send).toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith({
            content: '✅ Posted to: <#current-1>',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('replies error when channel empty and current channel is not text', async () => {
        const command = new AnnounceCommand();
        const interaction = createMockInteraction({ channel: { id: 'vc-1', type: ChannelType.GuildVoice } });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'The current channel is not a text or announcement channel.',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('resolves comma-separated channel names and posts to each', async () => {
        const command = new AnnounceCommand();
        const sendA = jest.fn().mockResolvedValue(undefined);
        const sendB = jest.fn().mockResolvedValue(undefined);
        const interaction = createMockInteraction({
            channelArg: 'news, #general',
            guildChannels: [
                textChannel('a-1', 'news', sendA),
                textChannel('b-1', 'general', sendB),
            ],
        });

        await command.execute(interaction);

        expect(sendA).toHaveBeenCalled();
        expect(sendB).toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith({
            content: '✅ Posted to: <#a-1>, <#b-1>',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('resolves channel mentions and skips voice channels', async () => {
        const command = new AnnounceCommand();
        const send = jest.fn().mockResolvedValue(undefined);
        const interaction = createMockInteraction({
            channelArg: '<#111>',
            guildChannels: [textChannel('111', 'news', send)],
        });

        await command.execute(interaction);

        expect(send).toHaveBeenCalled();
    });

    test('replies error when no channels resolve', async () => {
        const command = new AnnounceCommand();
        const interaction = createMockInteraction({ channelArg: 'does-not-exist' });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Could not resolve any channels: does-not-exist (not found or not a text channel)',
            flags: MessageFlags.Ephemeral,
        });
    });
});
