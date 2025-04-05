// scheduler.ts
import {type Client} from "discord.js";

const schedule: {
    execute: (channels: any, client: Client) => {}
    type: 'daily' | 'weekly' | 'monthly' | 'once' | 'minutely' | 'hourly'
    time: string
    name: string
    description?: string
    timezone?: string
}[] = []

export function addScheduledEvent(event: {
    execute: () => {}
    type: 'daily' | 'weekly' | 'monthly' | 'once' | 'minutely' | 'hourly'
    time: string
    name: string
    description?: string
    timezone?: string
}) {
    schedule.push(event)
}

export function setupScheduledEvents(channels: any, client: Client) {
    setInterval(() => {
        const now = new Date();
        const day = now.getDay(); // 0 is Sunday
        const hour = now.getHours();
        const minute = now.getMinutes();
        const month = now.getMonth(); // 0 is January

        schedule.forEach((event) => {
            const eventDate = new Date(event.time);
            const eventDay = eventDate.getDay();
            const eventHour = eventDate.getHours();
            const eventMinute = eventDate.getMinutes();
            const eventMonth = eventDate.getMonth(); // 0 is January

            if (event.type === 'daily' && hour === eventHour && minute === eventMinute) {
                event.execute(channels, client)
            } else if (event.type === 'weekly' && day === eventDay && hour === eventHour && minute === eventMinute) {
                event.execute(channels, client)
            } else if (event.type === 'monthly' && day === eventDay && hour === eventHour && minute === eventMinute && month === eventMonth) {
                event.execute(channels, client)
            } else if (event.type === 'once' && day === eventDay && hour === eventHour && minute === eventMinute) {
                event.execute(channels, client)
            } else if (event.type === 'minutely') {
                event.execute(channels, client)
            } else if (event.type === 'hourly' && hour === eventHour && minute === eventMinute) {
                event.execute(channels, client)
            }
        });

    }, 60000) // every minute
}