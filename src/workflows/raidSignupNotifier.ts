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
    const timeWindow = '1 hour';
    const communicationCode = 'raid_signup_notifier';
    
    const recentSignupsQuery = `
        SELECT 
            rp.member_id,
            rp.raid_id,
            rp.created_at,
            rp.updated_at,
            rp.details->>'status' AS status,
            rp.details->>'role' AS role,
            rr.raid_date,
            rr.time,
            r.name AS raid_name,
            m.character->>'name' AS character_name,
            m.character->'character_class'->>'name' AS character_class
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
        role: string,
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
            role: string,
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
            role: signup.role,
            memberId: signup.member_id
        });
    });

    // Fetch aggregated counts of status by role per raid
    const raidIds = Object.keys(raidSignups);
    const countsQuery = `
        SELECT 
            raid_id, 
            details->>'status' AS status, 
            details->>'role' AS role, 
            COUNT(*) AS count
        FROM public.ev_raid_participant
        WHERE raid_id = ANY($1::uuid[])
        GROUP BY raid_id, status, role;
    `;
    const { data: countsData } = await safeQuery<{ raid_id: string; status: string; role: string; count: string }[]>(() =>
        db.query(countsQuery, [raidIds]).then(r => r.rows)
    );
    // Organize counts by raid
    const raidCounts: Record<string, Record<string, Record<string, number>>> = {};
    countsData?.forEach(row => {
        raidCounts[row.raid_id] ||= {};
        raidCounts[row.raid_id][row.status] ||= {};
        raidCounts[row.raid_id][row.status][row.role] = Number(row.count);
    });

    let content = '🐙 **New Raid Signups Alert** 🐙\n\n';
    Object.values(raidSignups).forEach(raid => {
        // insert summary of counts
        const counts = raidCounts[raid.raidId] || {};
        content += '**Current Raid Status:**\n';
        Object.entries(counts).forEach(([status, roles]) => {
            const emoji = status === 'confirmed' ? '✅' : status === 'late' ? '⏰' : '❓';
            const rolesList = Object.entries(roles)
                .map(([roleName, cnt]) => `${roleName}: ${cnt}`)
                .join(', ');
            content += `${emoji} ${status}: ${rolesList}\n`;
        });
        content += '\n';

        const formattedDate = moment(raid.raidDate).format('dddd, D MMMM'); // e.g. "Sunday, 18 May"
        content += `📅 **${raid.raidName}** on ${formattedDate}\n`;
        content += '```\n';
        raid.signups.forEach(signup => {
            const statusEmoji = signup.status === 'confirmed' ? '✅' : '❓';
            content += `${statusEmoji} ${signup.characterName} (${signup.characterClass}) - ${signup.status} (${signup.role})\n`;
        });
        
        content += '```\n';
        content += `🔗 [View Raid Details](<https://www.everlastingvendetta.com/raid/${raid.raidId}>)\n\n`;
    });

    try {
        const delivery = await createDelivery({
            id: 6,
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

