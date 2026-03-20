import { FindCandidatesForClassRoleUseCase } from "../../application/usecases/discord/find-candidates-for-class-role.usecase";
import { DatabaseClient } from "../../infrastructure/database/db";
import { DiscordApiAdapter } from "../../infrastructure/discord/discord-api.adapter";
import { MembersRepository } from "../../infrastructure/persistance/repositories/members/members.repository";

describe('FindCandidatesForClassRoleUseCase', () => {
    test('should return candidates for a class role', async () => {
        const usecase = new FindCandidatesForClassRoleUseCase(
            new MembersRepository(new DatabaseClient()),
            new DiscordApiAdapter(),
        );

        const result = await usecase.execute({ guildId: '702280986993492088', className: 'warlock' });
        console.log(result);
        expect(result).toBeDefined();
        expect(Array.isArray(result.insert)).toBe(true);
        expect(result.insert.length).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(result.remove)).toBe(true);
        expect(result.remove.length).toBeGreaterThanOrEqual(0);
    }, 30000);
});
