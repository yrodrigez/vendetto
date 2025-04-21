import {type Client} from "discord.js";
import db, {safeQuery} from "../databse/db";
import {createDelivery} from "../delivery";
import {findDeliveryByName} from "../util/findDeliveryByName";

export const scheduler: { type: string; time: string, startNow: boolean } = {
    type: 'daily',
    time: '2025-04-05T17:30:00',
    startNow: true,
}

export const name = 'Been a Long Time';

export async function execute(client: Client) {
    const communicationCode = 'beenLongTime'
    const timeInterval = '3 weeks'
    const query = `
        WITH recent_participants AS (SELECT DISTINCT member_id
                                     FROM public.ev_raid_participant
                                     WHERE created_at >= NOW() - $2::interval),
             older_participants AS (SELECT DISTINCT member_id
                                    FROM public.ev_raid_participant
                                    WHERE created_at < NOW() - $2::interval),
             recent_wow_accounts AS (SELECT DISTINCT m.wow_account_id
                                     FROM public.ev_raid_participant rp
                                              JOIN public.ev_member m ON m.id = rp.member_id
                                     WHERE rp.created_at >= NOW() - $2::interval
                                       AND m.wow_account_id != 0),
             alt_names AS (
                 -- Names that belong to accounts with wow_account_id != 0
                 SELECT character ->> 'name' AS name
                 FROM public.ev_member
                 WHERE wow_account_id != 0),
             already_notified AS (SELECT "to"
                                  FROM open_campaign.broadlog
                                  WHERE communication_code = $1)
        SELECT DISTINCT dm.discord_user_id     AS discord_id,
                        m.character ->> 'name' AS name,
                        m.wow_account_id       AS account_id
        FROM public.discord_members dm
                 JOIN public.ev_member m ON dm.member_id = m.id
        WHERE m.id NOT IN (SELECT member_id FROM recent_participants)
          AND m.id IN (SELECT member_id FROM older_participants)
          AND m.wow_account_id NOT IN (SELECT wow_account_id FROM recent_wow_accounts)
          AND NOT (
            m.wow_account_id = 0
                AND (m.character ->> 'name') IN (SELECT name FROM alt_names)
            )
          AND dm.discord_user_id NOT IN (SELECT "to" FROM already_notified)
        ORDER BY name
    `

    const {data, error} = await safeQuery<{ discord_id: string, name: string, account_id: number }[]>(() =>
        db.query(query, [communicationCode, timeInterval]).then(r => r.rows)
    );

    if (error) {
        console.error('Error fetching members:', error);
        return;
    }

    if (!data?.length) {
        console.log('No members to notify for campaign', communicationCode);
        return;
    }

    console.log(`Members to notify ${communicationCode}:`, data);
    const deliveryId = await findDeliveryByName('beenLongTime')
    const delivery = await createDelivery({
        id: deliveryId,
        client,
        target: data.map(p => ({discordId: p.discord_id})),
        targetData: data.map((x) => ({userName: x.name, discordId: x.discord_id})),
        targetMapping: {identifier: 'discordId', targetName: 'user'},
        message: {
            communicationCode,
            targetMapping: {targetName: 'user'},
            content: `
            # 🐙 Vendetto from Everlasting Vendetta here, waving all my eight arms excitedly! 🐙

            Hey {{{targetData.userName}}}! We've noticed it's been quite a while since you've last journeyed with Everlasting Vendetta. Azeroth has evolved, and our ocean feels a little emptier without you! 🌊
            
            ## Exciting things have been happening:
            
            - New Raid: [Scarlet Enclave](<https://news.blizzard.com/en-us/article/24188044/season-of-discovery-phase-8-scarlet-enclave-raid-now-live>) – Dive into this challenging 8-boss raid with unique mechanics and epic loot.
            - [Legendary Weapon Questline](<https://news.blizzard.com/en-us/article/24188044/season-of-discovery-phase-8-scarlet-enclave-raid-now-live>) – Warriors, Hunters, and Paladins can embark on a quest to restore a fallen weapon to its former glory.
            - New Outdoor Content – Infiltrate New Avalon in disguise, learn new recipes, and uncover surprises.
            
            We'd love to have you back with us for more thrilling raids, new adventures, and countless laughs. Your guildmates miss you dearly and can't wait to see your return!
            
            Don't forget to visit our [calendar](<https://www.everlastingvendetta.com/calendar>) for the latest upcoming raids and events—we've got some exciting new content you definitely won't want to miss!
            
            Why not swing by our Discord or simply log in and splash around with us again? 🌊
            
            Hope to see you soon!
            
            Warm tentacle hugs,
            Your friendly guild octopus, Vendetto 🐙
            # Everlasting Vendetta Team
            `
        }
    })

    if (!delivery) {
        console.error('Error creating delivery');
        return;
    }

    const {successful, failed} = await delivery.send();

    console.log(`Delivery ${communicationCode} successful:`, successful.length);
    console.log(`Delivery ${communicationCode} failed:`, failed.length);
}
