import {Client, TextChannel} from "discord.js";

export const scheduler: { type: string; time: string } = {
    type: 'minutely',
    time: '2025-04-05T00:00:00Z',
}

export const name = 'test'

export async function execute(channels: { [key: string]: string }, client: Client) {

    const channel = client.channels.cache.get(channels.general) as TextChannel
    if (channel && channel.send) {
        await channel.send('Hello world!')
    } else {
        console.error('Channel not found')
    }
}