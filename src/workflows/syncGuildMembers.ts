import {Client} from "discord.js";
import {hasFeature} from "../util/features";
import {createServerComponentClient} from "../supabase";
import {createDelivery} from "../delivery";
import seedList from "../seeds";

export const scheduler: { type: string; time: string, startNow: boolean } = {
    type: 'hourly',
    time: '2025-04-05T20:14:00',
    startNow: true,
}

export const name = 'Sync Guild Members';

function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD')                   // Decompose characters with diacritics
        .replace(/[\u0300-\u036f]/g, '')    // Remove diacritical marks
        .replace(/[-\/\\_()]/g, ' ')          // Replace special chars with spaces
        .replace(/\s+/g, ' ')               // Normalize multiple spaces
        .trim();
}

export async function execute(client: Client) {
    await client.guilds.fetch();
    const guilds = client.guilds.cache.filter(guild => {
        return hasFeature("syncGuildMembers", guild.id);
    });

    const discordMembers = (await Promise.all(guilds.map(async (guild) => {
        const guildMembers = await guild.members.fetch();
        return guildMembers.filter(member => !member.user.bot).map(member => member);
    }))).flat();

    if (!discordMembers.length) {
        console.log('No members found');
        return;
    }

    const supabase = createServerComponentClient()
    const {data: withData, error: withError} = await supabase.from('discord_members')
        .select('member_id')

    if (withError) {
        console.error('Error fetching members from supabase:', withError);
        return;
    }

    const {data: databaseMembers, error} = await supabase
        .from('ev_member')
        .select('id, character, wow_account_id')
        .not('id', 'in', `(${(withData?.map(x => x.member_id) || [])})`)


    if (error) {
        console.error('Error fetching members from supabase:', error);
        return;
    }

    const lowercaseNames = discordMembers.map(member =>
        normalizeString(member.nickname || member.displayName.toString() || member.user.username)
    );

    const filteredData = databaseMembers.filter(record =>
        lowercaseNames.includes(normalizeString(record.character.name))
    );

    if (!filteredData.length) {
        console.log('No new members to insert');
        return;
    }

    const payload = filteredData.map(record => {
        const discordUser = discordMembers.find(member => {
            return normalizeString(member.nickname || member.displayName.toString() || member.user.username) === normalizeString(record.character.name)
        });
        if (!discordUser) {
            console.log('No discord user found for member:', record.character.name);
            return null
        }
        return {
            member_id: record.id,
            discord_user_id: discordUser.user.id,
            guild_id: discordUser.guild.id,
            updated_at: new Date(),
            discord_user: discordUser.user,
            name: record.character.name,
        }
    })
        .filter(x => !!x)
        .reduce((acc, curr) => {
            acc.push(curr)
            const wowAccountId = databaseMembers.find(x => x.id === curr.member_id && x.wow_account_id !== 0)?.wow_account_id;
            if (!wowAccountId) {
                console.log('No wow account id for member:', curr.member_id);
                return acc;
            }
            const alters = databaseMembers.filter(x => x.wow_account_id === wowAccountId && x.id !== curr.member_id);
            if (alters.length) {
                acc.push(...alters.map(alter => ({
                    member_id: alter.id,
                    discord_user_id: curr.discord_user_id,
                    guild_id: curr.guild_id,
                    updated_at: new Date(),
                    discord_user: curr.discord_user,
                    name: alter.character.name,
                })));
            }
            return acc
        }, [] as {
            member_id: string,
            discord_user_id: string,
            guild_id: string,
            updated_at: Date,
            discord_user: any,
            name: string,
        }[])

    const uniquePayload = Array.from(
        new Map(payload.map(item => [`${item.member_id}_${item.discord_user_id}`, item])).values()
    );

    if (!uniquePayload.length) {
        console.log('No members to insert');
        return;
    }


    const {error: errorInsert} = await supabase
        .from('discord_members')
        .upsert(
            uniquePayload,
            {onConflict: 'member_id,discord_user_id'}
        )
        .select('member_id,discord_user_id,guild_id,updated_at,created_at')

    if (errorInsert) {
        console.error('Error upserting members to supabase:', errorInsert);
    } else {
        console.log('Inserted members:', payload.length);
        if (payload.length) {
            try {
                const delivery = await createDelivery({
                    id: 6, // Notification
                    client,
                    target: seedList.map(x => ({discordId: x})),
                    targetData: [],
                    targetMapping: {
                        targetName: 'user',
                        identifier: 'discordId',
                    },
                    message: {
                        communicationCode: name,
                        targetMapping: {targetName: 'user'},
                        content: `${payload.length} new members inserted!`
                    }
                })
                await delivery.send();
            } catch (e) {
                console.error('Sync Guild Members Error: ', e);
            }
        }
    }
}