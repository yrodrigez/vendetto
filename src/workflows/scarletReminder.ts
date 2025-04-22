import type {Client} from "discord.js";
import db, {safeQuery} from "../databse/db";
import {createDelivery} from "../delivery";
import seedList from "../seeds";

export const scheduler: { type: string; time: string, startNow: boolean } = {
    type: 'daily',
    time: '2025-04-05T20:14:00',
    startNow: true,
}

export const name = 'SCARLET_REMINDER';

export async function execute(client: Client) {
    const query = `
        WITH next_raid_signups AS (SELECT DISTINCT rp.member_id,
                                                   rp.raid_id,
                                                   rr.raid_date,
                                                   rr.time,
                                                   rp.details ->> 'status' AS status,
                                                   r.name                  AS raid_name
                                   FROM public.ev_raid_participant rp
                                            JOIN public.raid_resets rr on rr.id = rp.raid_id
                                            JOIN public.ev_raid r ON r.id = rr.raid_id
                                   WHERE r.name = 'Scarlet Enclave'
                                     AND rr.raid_date::date >= CURRENT_DATE + INTERVAL '12 hours'
                                     AND rr.raid_date::date < CURRENT_DATE + INTERVAL '36 hours'
                                     AND rp.details ->> 'status' != 'declined')
           , already_notified AS (SELECT "to"
                                  FROM open_campaign.broadlog
                                           CROSS JOIN next_raid_signups
                                  WHERE communication_code = 'SCARLET_REMINDER'
                                    AND created_at::date >= NOW() - INTERVAL '24 hours'
                                    AND last_event = 'success')
        SELECT DISTINCT dm.discord_user_id     AS discord_id,
                        m.character ->> 'name' AS name,
                        m.wow_account_id       AS account_id,
                        ((rp.raid_date::text || ' ' || rp.time ::text):: timestamp at time zone
                         'Europe/Madrid')      AS raid_date,
                        rp.raid_name           AS raid_name,
                        rp.raid_id             AS raid_id
        FROM public.discord_members dm
                 JOIN next_raid_signups rp ON dm.member_id = rp.member_id
                 JOIN public.ev_member m ON dm.member_id = m.id
        WHERE dm.discord_user_id NOT IN (SELECT "to" FROM already_notified)
        ORDER BY name;
    `

    const {data, error} = await safeQuery<{
        discord_id: string,
        name: string,
        account_id: string,
        raid_date: string,
        raid_name: string,
        raid_id: string
    }[]>(() =>
        db.query(query, []).then(r => r.rows)
    );

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    if (!data?.length) {
        console.log('No new signups for Scarlet Enclave');
        return;
    }

    const targetData = data.map(({discord_id, name, account_id, raid_date, raid_name, raid_id}) => ({
        discordId: discord_id,
        name,
        accountId: account_id,
        raidDate: raid_date,
        raidName: raid_name,
        raidId: raid_id,
    }));

    const pdfUrl = '<https://drive.google.com/file/d/1wqEIPdwaWZAUx_bdgSRCE5DM8u7CFKsg/view>';
    const srURL = '<https://www.everlastingvendetta.com/raid/{{{targetData.raidId}}}/soft-reserv>';
    const termsURL = '<https://www.everlastingvendetta.com/terms>';
    const videoURL = '<https://www.youtube.com/watch?v=YZfkwr-jsqM>';

    const delivery = await createDelivery({
        id: 5,
        client,
        target: data?.map(({discord_id}) => ({discordId: discord_id})),
        targetData,
        targetMapping: {
            targetName: 'user',
            identifier: 'discordId',
        },
        message: {
            seedList,
            communicationCode: name,
            targetMapping: {targetName: 'user'},
            content: `
            🐙 Hey there, {{{targetData.name}}}! 🐙

            Congratulations—you're bravely (or foolishly) confirmed for our next adventure: {{{targetData.raidName}}}! ⚔️ 
            
            Since we're committed to reducing embarrassing wipe-counts (for a change), 
            our beloved Felsargon has assembled an [PDF guide](${pdfUrl})
            If reading isn’t your thing—and let's be honest, we've noticed—we've even found you a shiny [video](${videoURL}) version so simple, even I might understand.
            
            Make sure to review your Soft Reserves [here](${srURL}) 
            and double-check the [Loot Terms](${termsURL}) to avoid any surprises.
            
            Let's ensure we're geared up, prepared, and ready!
            
            See you in battle!
            
            🐙 Your favorite octopus, Vendetto, Vendetto 🐙
            `
        }
    })

    const {successful, failed} = await delivery.send();

    console.log(`Delivery ${name} successful:`, successful.length);
    console.log(`Delivery ${name} failed:`, failed.length);
}