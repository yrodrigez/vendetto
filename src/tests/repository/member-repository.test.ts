import { newDb } from "pg-mem";
import { MembersRepository } from "../../infrastructure/persistance/repositories/members/members.repository";
import { DatabaseClient } from "@/infrastructure/database/db";

function createTestDatabaseClient() {
    const db = newDb();

    db.public.none(`
        CREATE SCHEMA IF NOT EXISTS ev_auth;

        CREATE TABLE ev_member (
            id INTEGER PRIMARY KEY,
            user_id TEXT NOT NULL,
            character JSONB NOT NULL,
            is_selected BOOLEAN NOT NULL DEFAULT false
        );

        CREATE TABLE ev_auth.oauth_providers (
            user_id TEXT NOT NULL,
            provider TEXT NOT NULL,
            provider_user_id TEXT NOT NULL
        );

        CREATE TABLE discord_members (
            member_id INTEGER PRIMARY KEY,
            discord_user_id TEXT NOT NULL
        );
    `);

    const client = {
        query: async <T>(text: string, params?: any[]): Promise<T[]> => {
            const prepared = db.public.prepare(text);
            const bound = prepared.bind(params ?? []);
            const result = bound.executeAll();
            return result.rows as T[];
        },
        pool: {} as any,
    } as unknown as DatabaseClient;

    return { db, client };
}

function selectedCharacterSeedData(db: ReturnType<typeof newDb>) {
    db.public.none(`
        INSERT INTO ev_member (id, user_id, character, is_selected) VALUES
        (1, 'user-1', '{"name": "Thrall", "character_class": {"name": "Warrior"}, "guild": {"name": "Horde"}, "realm": {"slug": "draenor"}}', true),
        (2, 'user-2', '{"name": "Jaina", "character_class": {"name": "Mage"}, "guild": {"name": "Alliance"}, "realm": {"slug": "silvermoon"}}', true),
        (3, 'user-3', '{"name": "Ignored", "character_class": {"name": "Rogue"}, "guild": {"name": "None"}, "realm": {"slug": "test"}}', false);

        INSERT INTO ev_auth.oauth_providers (user_id, provider, provider_user_id) VALUES
        ('user-1', 'discord_oauth', '111'),
        ('user-2', 'discord_oauth', '222'),
        ('user-2', 'bnet_oauth', '999'),
        ('user-3', 'discord_oauth', '333');

    `);
}

function seedDataCharacterRealm(db: ReturnType<typeof newDb>) {
    db.public.none(`
        INSERT INTO ev_member (id, user_id, character, is_selected) VALUES
        (4, 'user-4', '{"name": "Anduin", "character_class": {"name": "Priest"}, "guild": {"name": "Alliance"}, "realm": {"slug": "stormrage"}}', true),
        (5, 'user-5', '{"name": "Sylvanas", "character_class": {"name": "Hunter"}, "guild": {"name": "Horde"}, "realm": {"slug": "tichondrius"}}', true),
        (3, 'user-3', '{"name": "Manolo", "character_class": {"name": "Warrior"}, "guild": {"name": "Stuff"}, "realm": {"slug": "lone-wolf"}}', false),
        (6, 'user-6', '{"name": "Guldan", "character_class": {"name": "Warlock"}, "guild": {"name": "Horde"}, "realm": {"slug": "draenor"}}', true),
        (7, 'user-7', '{"name": "Thrall", "character_class": {"name": "Warrior"}, "guild": {"name": "Horde"}, "realm": {"slug": "draenor"}}', true);
        
        INSERT INTO ev_auth.oauth_providers (user_id, provider, provider_user_id) VALUES
        ('user-4', 'discord_oauth', '444'),
        ('user-5', 'discord_oauth', '555'),
        ('user-6', 'discord_oauth', '666'),
        ('user-3', 'discord_oauth', '333'),
        ('user-7', 'bnet_oauth', '777');
    `);
}

function clearData(db: ReturnType<typeof newDb>) {
    db.public.none(`
        truncate table ev_member;
        truncate table ev_auth.oauth_providers;
    `);
}

describe('MembersRepository', () => {
    test('findAllSelectedCharacters returns only selected members with discord oauth', async () => {
        const { db, client } = createTestDatabaseClient();
        selectedCharacterSeedData(db);

        const membersRepository = new MembersRepository(client);
        const result = await membersRepository.findAllSelectedCharactersDiscord();

        expect(result).toHaveLength(2);
        expect(result).toEqual(expect.arrayContaining([
            {
                discordId: '111',
                character: {
                    id: 1,
                    name: 'Thrall',
                    class: 'warrior',
                    guild: 'horde',
                    realmSlug: 'draenor',
                },
            },
            {
                discordId: '222',
                character: {
                    id: 2,
                    name: 'Jaina',
                    class: 'mage',
                    guild: 'alliance',
                    realmSlug: 'silvermoon',
                },
            },
        ]));
    });

    test('findAllSelectedCharacters excludes non-selected members', async () => {
        const { db, client } = createTestDatabaseClient();
        selectedCharacterSeedData(db);

        const membersRepository = new MembersRepository(client);
        const result = await membersRepository.findAllSelectedCharactersDiscord();

        const discordIds = result.map(r => r.discordId);
        expect(discordIds).not.toContain('333');
    });

    test('findAllSelectedCharacters includes only discord oauth members', async () => {
        const { db, client } = createTestDatabaseClient();
        selectedCharacterSeedData(db);

        const membersRepository = new MembersRepository(client);
        const result = await membersRepository.findAllSelectedCharactersDiscord();

        const discordIds = result.map(r => r.discordId);

        expect(discordIds).toEqual(expect.arrayContaining(['111', '222']));
        expect(discordIds).not.toContain('999');
    });

    test('findAllSelectedCharacters returns empty array when no data', async () => {
        const { client } = createTestDatabaseClient();

        const membersRepository = new MembersRepository(client);
        const result = await membersRepository.findAllSelectedCharactersDiscord();

        expect(result).toEqual([]);
    });

    test('findAllCharacters in realmSlug', async () => {
        const { db, client } = createTestDatabaseClient();
        clearData(db);
        seedDataCharacterRealm(db);

        const membersRepository = new MembersRepository(client);
        const result = await membersRepository.findAllInRealm('draenor');

        expect(result).toHaveLength(1); // excludes non-discord oauth
    });

    test('findAllCharacters in realmSlug disregarding is_selected', async () => {
        const { db, client } = createTestDatabaseClient();
        clearData(db);
        seedDataCharacterRealm(db);

        const membersRepository = new MembersRepository(client);
        const result = await membersRepository.findAllInRealm('lone-wolf');

        expect(result).toHaveLength(1); // includes non-selected
    });

    test('findAllCharacters in guild for discord_oauth users', async () => {
        const { db, client } = createTestDatabaseClient();
        clearData(db);
        seedDataCharacterRealm(db);

        const membersRepository = new MembersRepository(client);
        const result = await membersRepository.findAllInGuild('horde');

        expect(result).toHaveLength(2); // includes multiple characters in same guild and realm
    });
});
