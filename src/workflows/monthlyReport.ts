import {type Client} from "discord.js";
import db, {safeQuery} from "../databse/db";
import {createDelivery} from "../delivery";
import {findDeliveryByName} from "../util/findDeliveryByName";

export const scheduler: { type: string; time: string, startNow: boolean } = {
    type: 'daily',
    time: '2025-04-05T19:30:00Z',
    startNow: true,
}

export const name = 'Monthly report'

export async function execute(client: Client) {
    const communicationCode = 'monthlyReport'
    const timeInterval = '1 month'
    const query = `
        WITH recent_active_members AS (SELECT DISTINCT rp.member_id
                                       FROM public.ev_raid_participant rp
                                       JOIN public.ev_member m ON m.id = rp.member_id
                                       WHERE rp.created_at >= NOW() - INTERVAL '1.5 month'  
                                         AND rp.details ->> 'status' != 'declined'
                                        AND m.character->'guild'->>'name' = 'Everlasting Vendetta'
                                       ),
             loot_in_the_last_month AS (SELECT m.id               AS member_id,
                                               COUNT(lh."itemID") AS item_count
                                        FROM public.ev_loot_history lh
                                                 JOIN public.ev_member m
                                                      ON m.character ->> 'name' = lh.character
                                        WHERE lh.created_at >= NOW() - INTERVAL '1 month'
                                        GROUP BY m.id),
             loot_ranking AS (SELECT member_id,
                                     item_count,
                                     RANK() OVER (ORDER BY item_count DESC) AS loot_rank,
                                     COUNT(*) OVER ()                       AS loot_rank_total
                              FROM loot_in_the_last_month),
             participation_in_the_last_month AS (SELECT rp.member_id,
                                                        COUNT(DISTINCT rp.raid_id) AS participation_count
                                                 FROM public.ev_raid_participant rp
                                                          JOIN public.raid_resets rr
                                                               ON rp.raid_id = rr.id
                                                 WHERE rp.created_at >= NOW() - INTERVAL '1 month'
                                                 GROUP BY rp.member_id),
             participation_ranking AS (SELECT member_id,
                                              participation_count,
                                              RANK() OVER (ORDER BY participation_count DESC) AS participation_rank,
                                              COUNT(*) OVER ()                                AS participation_rank_total
                                       FROM participation_in_the_last_month),
             already_notified AS (SELECT "to"
                                  FROM open_campaign.broadlog
                                  WHERE created_at >= NOW() - '1 day'::interval
                                     OR (
                                      communication_code = $1::text
                                          AND created_at >= NOW() - $2::interval
                                      ))

        SELECT dm.discord_user_id                       as discord_id,
               m.character ->> 'name'                   as name,
               COALESCE(lr.item_count, 0)               AS items_won_in_last_month,
               COALESCE(lr.loot_rank, 0)                AS loot_rank,
               COALESCE(lr.loot_rank_total, 0)          AS loot_rank_total,
               COALESCE(pr.participation_count, 0)      AS participation_count,
               COALESCE(pr.participation_rank, 0)       AS participation_rank,
               COALESCE(pr.participation_rank_total, 0) AS participation_rank_total

        FROM public.discord_members dm
                 JOIN public.ev_member m
                      ON dm.member_id = m.id
                 LEFT JOIN loot_ranking lr
                           ON lr.member_id = m.id
                 LEFT JOIN participation_ranking pr
                           ON pr.member_id = m.id
        WHERE m.id IN (SELECT member_id FROM recent_active_members)
          AND dm.discord_user_id NOT IN (SELECT "to" FROM already_notified)
          AND participation_count > 0
        ORDER BY m.id;
    `

    const {data, error} = await safeQuery<{
        discord_id: string,
        name: string
        items_won_in_last_month: number
        loot_rank: number
        loot_rank_total: number
        participation_count: number
        participation_rank: number
        participation_rank_total: number
    }[]>(() =>
        db.query(query, [communicationCode, timeInterval]).then(r => r.rows)
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
        name: p.name,
        items_won_in_last_month: p.items_won_in_last_month,
        loot_rank: p.loot_rank,
        loot_rank_total: p.loot_rank_total,
        participation_count: p.participation_count,
        participation_rank: p.participation_rank,
        participation_rank_total: p.participation_rank_total,
        lowerName: p.name.toLowerCase(),
        lootPositionDescription: `You're currently the ${p.loot_rank}${p.loot_rank === 1 ? 'st' : p.loot_rank === 2 ? 'nd' : p.loot_rank === 3 ? 'rd' : 'th'} luckiest (or most suspiciously lucky) member in the guild. If you’re top 5: congrats, the RNG gods clearly owe you money. If you’re dead last… well, there’s always disenchanting.`,
        participationPositionDescription: `This means you're the ${p.participation_rank}${p.participation_rank === 1 ? 'st' : p.participation_rank === 2 ? 'nd' : p.participation_rank === 3 ? 'rd' : 'th'} most active in the guild. ${p.participation_rank <= Math.ceil(p.participation_rank_total * 0.3)
            ? "heroic—your name echoes through the halls of loot and glory, almost as loudly as your vow to never touch a DPS meter in vain. Virginity? Intact only in the eyes of loot RNG."
            : p.participation_rank >= Math.ceil(p.participation_rank_total * 0.7)
                ? "so faint, we had to check the logs twice to confirm you still exist. We're not mad, just disappointed... but hey, more loot for the rest of us."
                : "present... like a summoned imp: useful, occasionally."}`,
    }))

    const deliveryId = await findDeliveryByName('monthlyReport')

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
            communicationCode: communicationCode,
            targetMapping: {targetName: 'user'},
            content: `
            🐙 Vendetto's Guild Report Scroll 🐙
            *Painstakingly compiled by an underpaid octopus with too many spreadsheets and not enough limbs.*
            
            📜 Here’s your monthly performance report, {{{targetData.name}}}!
            - 🧤 Items Won: {{{targetData.items_won_in_last_month}}}
                > Enough to stay under the loot radar, or did you loot like a dragon with tax issues?
            - 💰 Loot Rank: {{{targetData.loot_rank}}} out of {{{targetData.loot_rank_total}}}
                > {{{targetData.lootPositionDescription}}}
            - 🗓️ Raids Attended: {{{targetData.participation_count}}}.
            - ⚔️ Attendance Rank: {{{targetData.participation_rank}}} out of {{{targetData.participation_rank_total}}}
                > {{{targetData.participationPositionDescription}}}
            
            👉 [Check your profile here](<https://www.everlastingvendetta.com/roster/{{{targetData.lowerName}}}>)    
            💡 Pro tip: Confirming raids gets you loot. Not confirming raids gets you lectures. Possibly both.
            
            🐙 Yours in passive-aggressive affection,
            Vendetto,
            Guild Octopus.
            `
        }
    })

    const {successful, failed} = await delivery.send();

    console.log('Delivery successful:', successful.length);
    console.log('Delivery failed:', failed.length);
}