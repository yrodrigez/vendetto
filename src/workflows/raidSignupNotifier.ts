import {Client} from "discord.js";
import db, {safeQuery} from "../databse/db";
import {createDelivery} from "../delivery";
import seedList from "../seeds";
import moment from "moment";

export const scheduler: { type: string; time: string, startNow: boolean } = {
    type: 'hourly',
    time: '2025-04-05T20:00:00',
    startNow: true,
}

export const name = 'Raid Signup Notifier';

export async function execute(client: Client) {
    // Check for signups in the last hour
    const timeWindow = '1 hour';
    const communicationCode = 'raid_signup_notifier';
    
    // First, get recent signups
    const recentSignupsQuery = `
        SELECT 
            rp.member_id,
            rp.raid_id,
            rp.created_at,
            rp.updated_at,
            rp.details->>'status' AS status,
            rr.raid_date,
            rr.time,
            r.name AS raid_name,
            m.character->>'name' AS character_name,
            m.character->>'class' AS character_class
        FROM 
            public.ev_raid_participant rp
            JOIN public.raid_resets rr ON rr.id = rp.raid_id
            JOIN public.ev_raid r ON r.id = rr.raid_id
            JOIN public.ev_member m ON m.id = rp.member_id
        WHERE 
            (rp.created_at >= NOW() - $1::interval OR rp.updated_at >= NOW() - $1::interval)
        ORDER BY 
            rp.created_at DESC;
    `;

    const {data: recentSignups, error: recentError} = await safeQuery<{
        member_id: string,
        raid_id: string,
        created_at: string,
        updated_at: string,
        status: string,
        raid_date: string,
        time: string,
        raid_name: string,
        character_name: string,
        character_class: string
    }[]>(() =>
        db.query(recentSignupsQuery, [timeWindow]).then(r => r.rows)
    );

    if (recentError) {
        console.error('Error fetching recent raid signup data:', recentError);
        return;
    }

    if (!recentSignups?.length) {
        console.log('No new raid signups to notify about');
        return;
    }

    // Next, get already notified signups from the last hour
    const notifiedQuery = `
        SELECT 
            b."text" AS notification_text
        FROM 
            open_campaign.broadlog b
        WHERE 
            b.communication_code = $1
            AND b.created_at >= NOW() - $2::interval
            AND b.last_event = 'success';
    `;

    const {data: notifiedData, error: notifiedError} = await safeQuery<{
        notification_text: string
    }[]>(() =>
        db.query(notifiedQuery, [communicationCode, timeWindow]).then(r => r.rows)
    );

    if (notifiedError) {
        console.error('Error fetching notified data:', notifiedError);
        return;
    }

    // Filter out already notified signups
    // This is a simplistic approach - we'll consider a signup already notified if the character name 
    // and raid name appear in any previous notification text
    const notifiedTexts = notifiedData?.map(row => row.notification_text.toLowerCase()) || [];
    
    const newSignups = recentSignups.filter(signup => {
        const signupIdentifier = `${signup.character_name.toLowerCase()} ${signup.raid_name.toLowerCase()}`;
        return !notifiedTexts.some(text => text.includes(signupIdentifier));
    });

    if (!newSignups.length) {
        console.log('All recent signups have already been notified');
        return;
    }

    // Group signups by raid
    const raidSignups: Record<string, {
        raidName: string,
        raidDate: string,
        time: string,
        raidId: string,
        signups: Array<{
            characterName: string,
            characterClass: string,
            status: string,
            memberId: string
        }>
    }> = {};

    newSignups.forEach(signup => {
        const raidKey = `${signup.raid_id}`;
        
        if (!raidSignups[raidKey]) {
            raidSignups[raidKey] = {
                raidName: signup.raid_name,
                raidDate: signup.raid_date,
                time: signup.time,
                raidId: signup.raid_id,
                signups: []
            };
        }
        
        raidSignups[raidKey].signups.push({
            characterName: signup.character_name,
            characterClass: signup.character_class,
            status: signup.status,
            memberId: signup.member_id
        });
    });

    // Create content for the notification
    let content = '🐙 **New Raid Signups Alert** 🐙\n\n';
    
    Object.values(raidSignups).forEach(raid => {
        const formattedDate = moment(`${raid.raidDate} ${raid.time}`).format('dddd, MMMM Do [at] h:mm A');
        
        content += `📅 **${raid.raidName}** on ${formattedDate}\n`;
        content += '```\n';
        
        raid.signups.forEach(signup => {
            const statusEmoji = signup.status === 'confirmed' ? '✅' : '❓';
            content += `${statusEmoji} ${signup.characterName} (${signup.characterClass}) - ${signup.status}\n`;
        });
        
        content += '```\n';
        content += `🔗 [View Raid Details](<https://www.everlastingvendetta.com/raid/${raid.raidId}>)\n\n`;
    });

    // Send notification to the seedList
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
                communicationCode,
                targetMapping: {targetName: 'user'},
                content
            }
        });

        const {successful, failed} = await delivery.send();
        
        console.log(`Delivery ${communicationCode} successful:`, successful.length);
        console.log(`Delivery ${communicationCode} failed:`, failed.length);
    } catch (e) {
        console.error('Raid Signup Notifier Error:', e);
    }
}
