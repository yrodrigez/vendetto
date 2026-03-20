import { InsertDiscordMembersUseCase } from "../../application/usecases/discord/insert-discord-membets.usecase";
import pool, { DatabaseClient } from "../../infrastructure/database/db";
import { DiscordApiAdapter, getDiscordClient } from "../../infrastructure/discord/discord-api.adapter";
import { DiscordMembersRepository } from "../../infrastructure/persistance/repositories/discord-members/discord-members.repository";
import { UsersRepository } from "../../infrastructure/persistance/repositories/users/users.repository";
import { MembersRepository } from "../../infrastructure/persistance/repositories/members/members.repository";


describe('InsertDiscordMembersUseCase', () => {
    test('should insert discord members without errors', async () => {
        const db = new DatabaseClient();
        const usecase = new InsertDiscordMembersUseCase(
            new DiscordApiAdapter(),
            new DiscordMembersRepository(db),
            new UsersRepository(db),
            new MembersRepository(db),
        );

        const result = await usecase.execute({ guildId: '702280986993492088' });
        expect(result).toBeUndefined();

        await expect(usecase.execute({ guildId: '702280986993492088' })).resolves.not.toThrow();
    }, 30000);
});


afterAll(async () => {
    const client = await getDiscordClient();
    client.destroy();
    await pool.end();
});


