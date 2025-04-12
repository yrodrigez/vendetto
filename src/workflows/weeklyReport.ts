import {type Client} from "discord.js";

export const scheduler: { type: string; time: string, startNow: boolean } = {
    type: 'monthly',
    time: '2025-04-05T17:30:00Z',
    startNow: true,
}

export const name = 'Monthly report'

export async function execute(client: Client) {

}