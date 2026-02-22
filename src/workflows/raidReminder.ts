import {type Client} from "discord.js";
import db, {safeQuery} from "../databse/db";
import {createDelivery} from "../delivery";
import moment from "moment";
import {findDeliveryByName} from "../util/findDeliveryByName";
import seedList from "../seeds";

export const scheduler = {
    type: 'daily',
    time: '2025-04-05T17:30:00',
    startNow: false,
}

export const name = 'Campaign: Raid Reminder'

export async function execute(client: Client) {

    const recent_active_members = '1.5 month'
    const already_notified_delay = '2 day'
    const already_notified_code = 'raidReminder'
    const timezone = 'Europe/Madrid'
    const query = `
        WITH recent_active_members AS (SELECT DISTINCT m.id as member_id
                                       FROM public.ev_raid_participant rp
                                                join ev_member m on m.id = member_id
                                       WHERE rp.created_at >= NOW() - $1::interval
                                          OR m.created_at >= NOW() - $1::interval)
           , next_upcoming_raid AS (SELECT id, name, raid_date, time
                                    FROM public.raid_resets
                                    WHERE (raid_date::text || ' ' || time ::text):: timestamp > NOW() + '2 hours'::interval
                                      AND (raid_date::text || ' ' || time ::text):: timestamp < NOW() + '1 week'::interval
                                      AND (status != 'offline' OR status is null)
                                    ORDER BY (raid_date::text || ' ' || time ::text):: timestamp
                                    LIMIT 1)
           , next_raid_signups AS (SELECT DISTINCT member_id
                                   FROM public.ev_raid_participant
                                   WHERE raid_id = (SELECT id FROM next_upcoming_raid)
            --and details ->> 'status' != 'declined'
        )
           , accounts_with_signups AS (SELECT DISTINCT m.wow_account_id
                                       FROM public.ev_member m
                                                JOIN next_raid_signups nrs
                                                     ON m.id = nrs.member_id
                                       WHERE m.wow_account_id != 0)
           , already_notified AS (SELECT "to"
                                  FROM open_campaign.broadlog
                                           CROSS JOIN next_upcoming_raid
                                  WHERE communication_code = $2::text || '_' || next_upcoming_raid.id::text
                                    AND created_at::date >= NOW() - $3::interval
                                    AND last_event = 'success')
        SELECT DISTINCT dm.discord_user_id                                                              AS discord_id,
                        m.character ->> 'name'                                                          AS name,
                        m.wow_account_id                                                                AS account_id,
                        ((r.raid_date::text || ' ' || r.time ::text):: timestamp at time zone $4::text) AS raid_date,
                        r.name                                                                          AS raid_name,
                        r.id                                                                            AS raid_id
        FROM public.discord_members dm
                 JOIN next_upcoming_raid r ON true
                 JOIN public.ev_member m ON dm.member_id = m.id
        WHERE m.id IN (SELECT member_id FROM recent_active_members)
          AND m.id NOT IN (SELECT member_id FROM next_raid_signups)
          AND (
            m.wow_account_id = 0
                OR m.wow_account_id NOT IN (SELECT wow_account_id FROM accounts_with_signups)
            )
          AND dm.discord_user_id NOT IN (SELECT "to" FROM already_notified)
        ORDER BY name;
    `
    const {data, error} = await safeQuery<{
        discord_id: string
        name: string
        account_id: number
        raid_name: string
        raid_date: string
        raid_id: string
    }[]>(() =>
        db.query(query, [recent_active_members, already_notified_code, already_notified_delay, timezone]).then(r => r.rows)
    );

    if (error) {
        console.error('Error fetching raid reminder data:', error);
        return;
    }

    if (!data?.length) {
        console.log('No members to notify for raid reminder');
        return;
    }


    const target = data.map(p => ({discordId: p.discord_id}))
    const targetData = data.map(p => ({
        discordId: p.discord_id,
        raidName: p.raid_name,
        raidDate: moment(p.raid_date).format(
            'dddd, Do [at] h:mm A'
        ),
        accountId: p.account_id,
        memberId: p.discord_id,
        raidId: p.raid_id,
        characterName: p.name,
    }))

    const deliveryId = await findDeliveryByName('raidReminder')
    const communicationCode = already_notified_code + '_' + targetData[0].raidId
    const delivery = await createDelivery({
        id: deliveryId,
        client,
        target: target,
        targetData: targetData,
        targetMapping: {
            targetName: 'user',
            identifier: 'discordId',
        },
        message: {
            seedList,
            communicationCode,
            targetMapping: {targetName: 'user'},
            content: `
            # 🐙 Urgent Call from the Depths of Zangarmarsh! 🐙

            Hey {{{targetData.characterName}}}, the next **{{{targetData.raidName}}}** is almost upon us ({{{targetData.raidDate}}}), and you still haven't signed up!

            Are you okay? Did you get lost in the Twisting Nether? Trapped in a Shattered Halls gauntlet? Ganked in Hellfire Peninsula for the 47th time? 🔥
            
            ## 🌋 The Burning Crusade doesn't wait for stragglers!

            Illidan didn't declare "YOU ARE NOT PREPARED" just so you could prove him right by not showing up. We need your strength, your spark, and your beautiful brain to conquer Outland! 🧠
            
            - ⚔️ **Time's ticking faster than a rogue vanishing on a wipe.** The Dark Portal won't keep the invasion waiting. Sign up now, or forever explain to your gear why it's still quest greens.
            - 🕐 **The raid roster isn't going to fill itself!** We've got demons to slay, loot to distribute, and bosses to make regret their existence.
            - 📅 **Check the calendar, claim your spot**, and let's show these TBC raid bosses that Vendetta came prepared (unlike that one guy...).
            - 🔗 [**Sign up here before it's too late!**](<https://www.everlastingvendetta.com/raid/{{{targetData.raidId}}}>)
            
            Remember: In the words of the wise prophet of Outland—*"You are not prepared"*... but you COULD be, if you just clicked that signup button! 🎯

            *May the Light of A'dal guide you to the raid roster,*
            ## 🐙 Vendetto
            *Your fel-corrupted, emotionally unstable raid octopus*
            *Swimming through Serpentshrine since TBC Classic*
            `
        }
    })

    const {successful, failed} = await delivery.send();

    console.log(`Delivery ${communicationCode} successful:`, successful.length);
    console.log(`Delivery ${communicationCode} failed:`, failed.length);
}