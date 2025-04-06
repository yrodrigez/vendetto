import {Client} from "discord.js";
import {hasFeature} from "../util/features";
import {createServerComponentClient} from "../supabase";

export const scheduler: { type: string; time: string, startNow: boolean } = {
    type: 'daily',
    time: '2025-04-05T17:30:00Z',
    startNow: true,
}

export const name = 'Sync Guild Members';

function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD')                   // Decompose characters with diacritics
        .replace(/[\u0300-\u036f]/g, '')    // Remove diacritical marks
        .replace(/[-\/\\_]/g, ' ')          // Replace special chars with spaces
        .replace(/\s+/g, ' ')               // Normalize multiple spaces
        .trim();
}

export async function execute(client: Client) {
    await client.guilds.fetch();
    const guilds = client.guilds.cache.filter(guild => {
        return hasFeature("syncGuildMembers", guild.id);
    });

    const members = (await Promise.all(guilds.map(async (guild) => {
        const guildMembers = await guild.members.fetch();
        return guildMembers.filter(member => !member.user.bot).map(member => member);
    }))).flat();

    if (!members.length) {
        console.log('No members found');
        return;
    }

    const supabase = createServerComponentClient()
    const {data, error} = await supabase.from('ev_member').select('*')
    if (error) {
        console.error('Error fetching members from supabase:', error);
        return;
    }

    const lowercaseNames = members.map(member =>
        normalizeString(member.nickname || member.displayName.toString() || member.user.username)
    );

    const filteredData = data.filter(record =>
        lowercaseNames.includes(normalizeString(record.character.name))
    );

    const payload = filteredData.map(record => {
        const discordUser = members.find(member => {
            return normalizeString(member.nickname || member.displayName.toString() || member.user.username) === normalizeString(record.character.name)
        });
        if (!discordUser) return null;
        return {
            member_id: record.id,
            discord_user_id: discordUser.user.id,
            guild_id: discordUser.guild.id,
            updated_at: new Date(),
            discord_user: discordUser.user,
            name: record.character.name,
        }
    }).filter(Boolean);

    const {error: errorInsert} = await supabase
        .from('discord_members')
        .upsert(
            payload,
            {onConflict: 'member_id,discord_user_id'}
        )
        .select('member_id,discord_user_id,guild_id,updated_at,created_at')

    if (errorInsert) {
        console.error('Error upserting members to supabase:', error);
    } else {
        console.log('Inserted members:', payload.length);
    }
}