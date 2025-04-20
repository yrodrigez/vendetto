import {type Client} from "discord.js";
import db, {safeQuery} from "../databse/db.js";
import {createDelivery} from "../delivery/index.js";
import moment from "moment";
import {findDeliveryByName} from "../util/findDeliveryByName.js";

export const scheduler = {
    type: 'daily',
    time: '2025-04-05T17:30:00',
    startNow: true,
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
                                    WHERE (raid_date::text || ' ' || time ::text):: timestamp > NOW() + '1 day'::interval
                                      AND (raid_date::text || ' ' || time ::text):: timestamp < NOW() + '1 week'::interval
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
                                    AND created_at >= NOW() - $3::interval
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
            seedList: ['600220534885711893'],
            communicationCode: already_notified_code + '_' + targetData[0].raidId,
            targetMapping: {targetName: 'user'},
            content: `
            🐙 Urgent Call from Vendetto! 🐙

            Hey {{{targetData.characterName}}}, the next **{{{targetData.raidName}}}** is almost upon us ({{{targetData.raidDate}}}), and you still haven’t signed up!. You okay? Blink twice if you’re trapped in Stranglethorn again. 🧟
            
            But seriously—don’t leave us guessing like a pug tank pulling without buffs. We need your strength, your spark, and your beautiful brain 🧠.
            
            - ⚔️ Time’s ticking. The raid isn’t going to wait for the indecisive. Sign up now, or forever explain to your gear why it’s still blue.
            - 📅 Check the calendar, pick your spot, and let’s bring the pain (and maybe some cookies).
            - 🔗 [Sign up here](<https://www.everlastingvendetta.com/raid/{{{targetData.raidId}}}>)
            
            🐙 With an ominous tentacle wiggle,
            Vendetto, your emotionally unstable raid octopus
            `
        }
    })
    const {successful, failed} = await delivery.send();

    console.log('Delivery successful:', successful.length);
    console.log('Delivery failed:', failed.length);
}