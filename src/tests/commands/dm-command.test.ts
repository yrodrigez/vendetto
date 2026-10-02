import { DmCommand } from '@/application/commands/dm.command';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';

function createMockUser(id: string, username: string, tag: string) {
    return {
        id,
        username,
        tag,
        send: jest.fn().mockResolvedValue(undefined),
    };
}

function createMockInteraction(overrides: any = {}) {
    const guildMembers = overrides.guildMembers ?? [];
    const users = overrides.users ?? [];
    return {
        guildId: overrides.guildId !== undefined ? overrides.guildId : 'guild-1',
        memberPermissions: overrides.memberPermissions ?? {
            has: (flag: bigint) => flag === PermissionFlagsBits.Administrator,
        },
        guild: {
            members: {
                fetch: jest.fn(() =>
                    Promise.resolve({
                        find: (fn: (m: any) => boolean) => guildMembers.find(fn),
                    })
                ),
            },
        },
        client: {
            users: {
                fetch: jest.fn((id: string) => {
                    const user = users.find((u: any) => u.id === id);
                    return user ? Promise.resolve(user) : Promise.reject(new Error('Unknown User'));
                }),
            },
        },
        options: {
            getString: jest.fn((name: string) => {
                if (name === 'message') return overrides.message ?? 'Hello';
                return overrides.usersArg ?? '';
            }),
        },
        reply: jest.fn().mockResolvedValue(undefined),
    } as any;
}

describe('DmCommand', () => {
    test('replies ephemeral error when user lacks admin permission', async () => {
        const command = new DmCommand();
        const interaction = createMockInteraction({ memberPermissions: { has: () => false } });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'You do not have permission to use this command.',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('sends DM via mention', async () => {
        const command = new DmCommand();
        const user = createMockUser('111', 'bob', 'bob#1234');
        const interaction = createMockInteraction({ usersArg: '<@111>', users: [user] });

        await command.execute(interaction);

        expect(user.send).toHaveBeenCalledWith('Hello');
        expect(interaction.reply).toHaveBeenCalledWith({
            content: '✅ DM sent to: <@111>',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('resolves usernames and sends to multiple users', async () => {
        const command = new DmCommand();
        const alice = createMockUser('a-1', 'alice', 'alice#0001');
        const bob = createMockUser('b-1', 'bob', 'bob#1234');
        const interaction = createMockInteraction({
            usersArg: 'alice, @bob',
            users: [alice, bob],
            guildMembers: [
                { user: alice, displayName: 'Alice' },
                { user: bob, displayName: 'Bob' },
            ],
        });

        await command.execute(interaction);

        expect(alice.send).toHaveBeenCalledWith('Hello');
        expect(bob.send).toHaveBeenCalledWith('Hello');
        expect(interaction.reply).toHaveBeenCalledWith({
            content: '✅ DM sent to: <@a-1>, <@b-1>',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('reports unresolved users', async () => {
        const command = new DmCommand();
        const interaction = createMockInteraction({ usersArg: 'ghost' });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Could not resolve any users: ghost (user not found)',
            flags: MessageFlags.Ephemeral,
        });
    });

    test('reports DM send failures', async () => {
        const command = new DmCommand();
        const user = createMockUser('111', 'bob', 'bob#1234');
        user.send = jest.fn().mockRejectedValue(new Error('Cannot DM'));
        const interaction = createMockInteraction({ usersArg: '<@111>', users: [user] });

        await command.execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: '⚠️ Failed to DM: <@111>',
            flags: MessageFlags.Ephemeral,
        });
    });
});
