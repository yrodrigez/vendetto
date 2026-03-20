import { EvApiService } from "../../infrastructure/ev-api.service";

describe('ev-api-service tests', () => {
    test('should fetch data from EV API', async () => {
        const evApiService = new EvApiService();
        const roster = await evApiService.getRoster();
        expect(roster).toBeDefined();
        expect(Array.isArray(roster)).toBe(true);
        expect(roster.length).toBeGreaterThan(0);
        expect(roster[0]).toHaveProperty('id');
        expect(roster[0]).toHaveProperty('name');
        expect(roster[0]).toHaveProperty('realm');
        expect(roster[0]).toHaveProperty('level');
        expect(roster[0]).toHaveProperty('last_login_timestamp');
        expect(roster[0]).toHaveProperty('character_class');
        expect(roster[0]).toHaveProperty('guild');
        expect(roster[0]).toHaveProperty('avatar');
    });
});