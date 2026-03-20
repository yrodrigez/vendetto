import { FindMembersShouldBeInGuildRoleUsecase } from "../../application/usecases/discord/find-members-should-be-in-guild-role.usecase";
import { DatabaseClient } from "../../infrastructure/database/db";
import { DiscordApiAdapter } from "../../infrastructure/discord/discord-api.adapter";
import { EvApiService } from "../../infrastructure/ev-api.service";
import { MembersRepository } from "../../infrastructure/persistance/repositories/members/members.repository";

describe('FindMembersShouldBeInGuildRoleUsecase', () => {
    test('should return members in specified guild', async () => {
        const usecase = new FindMembersShouldBeInGuildRoleUsecase(
            new MembersRepository(new DatabaseClient()),
            new DiscordApiAdapter(),
            new EvApiService(),
        );

        const result = await usecase.execute({ guildId: '702280986993492088' });
        expect(result).toBeDefined();
        expect(Array.isArray(result.insert)).toBe(true);
        expect(result.insert.length).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(result.remove)).toBe(true);
        expect(result.remove.length).toBeGreaterThanOrEqual(0);
    }, 30000);
});