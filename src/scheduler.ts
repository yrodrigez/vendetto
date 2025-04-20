// scheduler.ts
import {type Client} from "discord.js";

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
        const now = new Date();
        const day = now.getDay(); // 0 is Sunday
        const hour = now.getHours();
        const minute = now.getMinutes();
        const month = now.getMonth(); // 0 is January

        const events = workflows.filter((event) => {
            const eventDate = new Date(event.time);
            const eventDay = eventDate.getDay();
            const eventHour = eventDate.getHours();
            const eventMinute = eventDate.getMinutes();
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
            } else if (event.type === 'hourly' && hour === eventHour && minute === eventMinute) {
                return true
            }
        });

        if (events.length === 0) {
            console.log('No events to execute', 'hour: ', hour, 'minute: ', minute, 'day: ', day, 'month: ', month)
            return
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