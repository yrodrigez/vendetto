import { MemberRepositoryPort } from "@/application/ports/outbound/member-repository.port";
import { DatabaseClient } from "@/infrastructure/database/db";

export class MembersRepository implements MemberRepositoryPort {
  constructor(private databaseClient: DatabaseClient) { }
  async findAllInGuild(guildName: string): Promise<{ discordId: string; character: { name: string; class: string; guild: string; realmSlug: string; id: string; }; }[]> {
    const query = `
  select
    p.provider_user_id as discord_id,
    m.character->>'name' as name,
    lower(m.character->'character_class'->>'name') as class,
      lower(m.character->'guild'->>'name') as guild,
      lower(m.character->'realm'->>'slug') as "realm_slug",
      m.id as id
    from ev_member m
      inner join ev_auth.oauth_providers p on p.user_id = m.user_id
    where p.provider = 'discord_oauth'
      and lower(m.character->'guild'->>'name') = lower($1)
UNION
  select
    distinct p.discord_user_id as discord_id,
    m.character->>'name' as name,
    lower(m.character->'character_class'->>'name') as class,
      lower(m.character->'guild'->>'name') as guild,
      lower(m.character->'realm'->>'slug') as "realm_slug",
      m.id as id
    from ev_member m
      inner join discord_members p on p.member_id = m.id
    where 
      lower(m.character->'guild'->>'name') = lower($1);
        `;
    const result = await this.databaseClient.query<{ discord_id: string; name: string; class: string; guild: string; realm_slug: string; id: string; }>(query, [guildName.toLowerCase()]);
    return result.map(r => ({
      discordId: r.discord_id,
      character: {
        id: r.id,
        name: r.name,
        class: r.class,
        guild: r.guild,
        realmSlug: r.realm_slug,
      }
    }))
  }

  async findAllInRealm(realmSlug: string): Promise<{ discordId: string; character: { name: string; class: string; guild: string; realmSlug: string; }; }[]> {
    const query = `select
  p.provider_user_id as discord_id,
  m.character->>'name' as name,
  lower(m.character->'character_class'->>'name') as class,
  lower(m.character->'guild'->>'name') as guild,
  lower(m.character->'realm'->>'slug') as "realm_slug"
  from ev_member m
  inner join ev_auth.oauth_providers p on p.user_id = m.user_id
  where p.provider = 'discord_oauth' and lower(m.character->'realm'->>'slug') = lower($1);
        `;
    const result = await this.databaseClient.query<{ discord_id: string; name: string; class: string; guild: string; realm_slug: string; }>(query, [realmSlug.toLowerCase()]);
    return result.map(r => ({
      discordId: r.discord_id,
      character: {
        name: r.name,
        class: r.class,
        guild: r.guild,
        realmSlug: r.realm_slug,
      }
    }));
  }

  async findAllSelectedCharacters(): Promise<{ name: string; class: string; guild: string; realmSlug: string; id: number; }[]> {
    const query = `select
  m.character->>'name' as name,
  lower(m.character->'character_class'->>'name') as class,
  lower(m.character->'guild'->>'name') as guild,
  lower(m.character->'realm'->>'slug') as "realm_slug",
  m.id as id
  from ev_member m
  where m.is_selected = true;
        `

    const result = await this.databaseClient.query<{ name: string; class: string; guild: string; realm_slug: string; id: number; }>(query);
    return result.map(r => ({
      name: r.name,
      class: r.class,
      guild: r.guild,
      realmSlug: r.realm_slug,
      id: r.id,
    }));
  }

  async findAllSelectedCharactersDiscord(): Promise<{ discordId: string; character: { name: string; class: string; guild: string; realmSlug: string; id: number }; }[]> {
    const query = `select
  p.provider_user_id as discord_id,
  m.character->>'name' as name,
  lower(m.character->'character_class'->>'name') as class,
  lower(m.character->'guild'->>'name') as guild,
  lower(m.character->'realm'->>'slug') as "realm_slug",
  m.id as id
  from ev_member m
  inner join ev_auth.oauth_providers p on p.user_id = m.user_id
  where m.is_selected = true and p.provider = 'discord_oauth'
        `
    const result = await this.databaseClient.query<{ discord_id: string; name: string; class: string; guild: string; realm_slug: string; id: number; }>(query);
    return result.map(r => ({
      discordId: r.discord_id,
      character: {
        id: r.id,
        name: r.name,
        class: r.class,
        guild: r.guild,
        realmSlug: r.realm_slug,
      }
    }))
  }
}