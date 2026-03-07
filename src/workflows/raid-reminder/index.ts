import { type Client } from "discord.js";
import db, { safeQuery } from "../../databse/db";
import { createDelivery } from "../../delivery";
import moment from "moment";
import { findDeliveryByName } from "../../util/findDeliveryByName";
import seedList from "../../seeds";
import fs from "fs";
import path from "path";

export const scheduler = {
    type: 'daily',
    time: '2025-04-05T17:30:00',
    startNow: false,
}

export const name = 'Campaign: Raid Reminder'

// Read the SQL query from the separate file once when the module loads
const query = fs.readFileSync(path.join(__dirname, 'raidReminder.sql'), 'utf8');
const content = fs.readFileSync(path.join(__dirname, 'content.md'), 'utf8');

export async function execute(client: Client) {

    if (!query) {
        console.error('SQL query for raid reminder not found');
        return;
    }

    if (!content) {
        console.error('Content for raid reminder not found');
        return;
    }

    const recent_active_members = '21 days'
    const already_notified_delay = '2 days'
    const already_notified_code = 'raidReminder'
    const timezone = 'Europe/Madrid'

    const { data, error } = await safeQuery<{
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


    const target = data.map(p => ({ discordId: p.discord_id }))
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
            targetMapping: { targetName: 'user' },
            content: content.trim(),
        }
    })

    const { successful, failed } = await delivery.send();

    console.log(`Delivery ${communicationCode} successful:`, successful.length);
    console.log(`Delivery ${communicationCode} failed:`, failed.length);
}