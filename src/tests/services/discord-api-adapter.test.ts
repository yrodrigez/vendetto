import { DiscordApiAdapter } from "../../infrastructure/discord/discord-api.adapter";

const GUILD_ID = '702280986993492088';
describe('discord-api-adapter tests', () => {
    test('should get roles from Discord API', async () => {
        const discordApiAdapter = new DiscordApiAdapter();
        const roles = await discordApiAdapter.findAllRoles(GUILD_ID);
        expect(roles).toBeDefined();
        expect(Array.isArray(roles)).toBe(true);
        expect(roles.length).toBeGreaterThan(0);
        expect(roles[0]).toHaveProperty('id');
        expect(roles[0]).toHaveProperty('name');
    });

    test('should find members in role from Discord API', async () => {
        const discordApiAdapter = new DiscordApiAdapter();
        const members = await discordApiAdapter.findMembersInRole(GUILD_ID, 'porco');
        
        expect(members).toBeDefined();
        expect(Array.isArray(members)).toBe(true);
        expect(members.length).toBeGreaterThan(0);
        expect(members[0]).toHaveProperty('id');
        expect(members[0]).toHaveProperty('user');
        expect(members[0].user).toHaveProperty('username');
    });

    test('should find all members from Discord API', async () => {
        const discordApiAdapter = new DiscordApiAdapter();
        const members = await discordApiAdapter.findAllMembers(GUILD_ID);
        expect(members).toBeDefined();
        expect(Array.isArray(members)).toBe(true);
        expect(members.length).toBeGreaterThan(0);
    });
});