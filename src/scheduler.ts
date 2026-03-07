// scheduler.ts
import { type Client } from "discord.js";

const workflows: {
    execute: (client: Client) => {}
    type: 'daily' | 'weekly' | 'monthly' | 'once' | 'minutely' | 'hourly'
    time: string
    name: string
    startNow?: boolean
    description?: string
    timezone?: string
}[] = []

export function addWorkflow(event: {
    execute: () => {}
    type: 'daily' | 'weekly' | 'monthly' | 'once' | 'minutely' | 'hourly'
    time: string
    name: string
    startNow?: boolean
    description?: string
    timezone?: string
}) {
    workflows.push(event)
}

export function setupWorkflows(client: Client) {

    workflows.filter((event) => event.startNow).forEach((event) => {
        event.execute(client)
    })

    setInterval(() => {
        const events = workflows.filter((event) => {
            const tz = event.timezone || "Europe/Madrid";

            const localNowString = new Date().toLocaleString("en-US", { timeZone: tz }).replace(/\u202F/g, ' ');
            const now = new Date(localNowString);
            
            const day = now.getDay(); // 0 is Sunday
            const hour = now.getHours(); // 0-23
            const minute = now.getMinutes(); // 0-59
            const month = now.getMonth(); // 0 is January


            const cleanEventTime = event.time.replace('Z', '');
            const eventDate = new Date(cleanEventTime);
            if (isNaN(eventDate.getTime())) {
                console.error('Invalid date format for event:', event.time, event.name);
                return false;
            }

            const timeMatch = cleanEventTime.match(/T(\d{2}):(\d{2})/);
            const eventHour = timeMatch ? parseInt(timeMatch[1], 10) : eventDate.getHours();
            const eventMinute = timeMatch ? parseInt(timeMatch[2], 10) : eventDate.getMinutes();

            const eventDay = eventDate.getDay();
            const eventMonth = eventDate.getMonth(); // 0 is January

            if (event.type === 'daily' && hour === eventHour && minute === eventMinute) {
                return true
            } else if (event.type === 'weekly' && day === eventDay && hour === eventHour && minute === eventMinute) {
                return true
            } else if (event.type === 'monthly' && day === eventDay && hour === eventHour && minute === eventMinute && month === eventMonth) {
                return true
            } else if (event.type === 'once' && day === eventDay && hour === eventHour && minute === eventMinute) {
                return true
            } else if (event.type === 'minutely') {
                return true
            } else if (event.type === 'hourly' && minute === eventMinute) {
                return true
            }
            return false;
        });

        if (events.length === 0) {
            return;
        }

        console.log('Executing events: ', events.map((event) => event.name).join(', '))
        Promise.all(events.map((event) => {
            event.execute(client)
        })).then(() => {
            console.log('Executed events: ', events.map((event) => event.name).join(', '))
        }).catch((e) => {
            console.error('Error executing events: ', e)
        })

    }, 60000) // every minute
}