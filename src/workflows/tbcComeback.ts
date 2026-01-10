import {type Client} from "discord.js";
import db, {safeQuery} from "../databse/db";
import {createDelivery} from "../delivery";
import {findDeliveryByName} from "../util/findDeliveryByName";
import seedList from "../seeds";

export const scheduler: { type: string; time: string, startNow: boolean } = {
    type: 'once',
    time: '2026-01-10T20:30:00',
    startNow: true,
}

export const name = 'TBC Comeback';

export async function execute(client: Client) {
    const communicationCode = 'tbcComeback'
    const query = `
        WITH ranked_characters AS (
            SELECT dm.discord_user_id                                                          AS discord_id,
                   m.character ->> 'name'                                                       AS name,
                   m.wow_account_id                                                             AS account_id,
                   ROW_NUMBER() OVER (
                       PARTITION BY dm.discord_user_id
                       ORDER BY
                           COALESCE((SELECT MAX(rp.created_at)
                                     FROM public.ev_raid_participant rp
                                     WHERE rp.member_id = m.id), '1970-01-01'::timestamp) DESC,
                           m.created_at DESC
                       )                                                                       AS rn
            FROM public.discord_members dm
                     JOIN public.ev_member m ON dm.member_id = m.id
        ),
             already_notified AS (SELECT "to"
                                  FROM open_campaign.broadlog
                                  WHERE communication_code = $1)
        SELECT discord_id,
               name,
               account_id
        FROM ranked_characters
        WHERE rn = 1
          AND discord_id NOT IN (SELECT "to" FROM already_notified)
        ORDER BY name
    `

    const {data, error} = await safeQuery<{ discord_id: string, name: string, account_id: number }[]>(() =>
        db.query(query, [communicationCode]).then(r => r.rows)
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
    const deliveryId = await findDeliveryByName('tbcComeback')
    const delivery = await createDelivery({
        id: deliveryId,
        client,
        target: data.map(p => ({discordId: p.discord_id})),
        targetData: data.map((x) => ({userName: x.name, discordId: x.discord_id})),
        targetMapping: {identifier: 'discordId', targetName: 'user'},
        message: {
            seedList,
            communicationCode,
            targetMapping: {targetName: 'user'},
            content: `
            # 🐙 *Slaps tentacles on the desk dramatically* IT'S HAPPENING! 🐙

            Hey {{{targetData.userName}}}! Your favorite guild octopus has some MASSIVE news to share!

            After nearly **8 months** of floating aimlessly through the cosmic void (and binge-watching Azerothian soap operas), **Everlasting Vendetta is officially making its grand return to TBC** on **Spineshatter Alliance**! 🎉

            ## 🔥 Why should you dust off that character and join us?

            - **The Burning Crusade awaits!** - Outland is calling, and this time we're going in TOGETHER
            - **Fresh start, same family** - Whether you're a veteran or returning after a break, we're rebuilding stronger than ever
            - **Epic raids ahead** - Karazhan, Gruul's Lair, Magtheridon, Serpentshrine Cavern... the loot gods are waiting
            - **The guild you remember** - Same vibes, same terrible jokes in raid chat, same questionable pulling decisions

            ## 🌊 What's the plan?

            We're reassembling the crew and getting ready to conquer Outland! Whether you mained a Chad Warrior, a Keyboard-turning Huntard, or a "I swear I'll interrupt this time" DPS, there's a spot with your name on it.

            Don't let your guildmates fight Illidan without you—he's not prepared, but WE should be!

            ## 🎮 Ready to jump back in?

            **Already on Spineshatter Alliance?** Perfect! Reach out to **@Mephius**, **@Alveric**, or **@Felsargon** in-game for a guild invite. Alternatively, you can apply directly through our website at [everlastingvendetta.com/apply](<https://www.everlastingvendetta.com/apply>).

            We've missed you, {{{targetData.userName}}}. Azeroth hasn't been the same without your questionable talent choices and legendary AFK moments. 💚

            *YOU ARE NOT PREPARED... to miss this comeback!*

            Warm tentacle hugs and portal summons,
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
