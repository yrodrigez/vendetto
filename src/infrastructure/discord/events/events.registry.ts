import { Client } from "discord.js";
import { DiscordEvent } from "./event.interface";

export class EventsRegistry {
    private onceEvents: DiscordEvent[] = [];
    private recurringEvents: DiscordEvent[] = [];
    public register(event: DiscordEvent) {
        if (event.once) {
            this.onceEvents.push(event);
        } else {
            this.recurringEvents.push(event);
        }
        console.log(`Registered event: ${event.name.toString()} (once: ${!!event.once})`);
    }

    public getEvents(): DiscordEvent[] {
        return [...this.onceEvents, ...this.recurringEvents];
    }

    public applyToClient(client: Client) {
        for (const event of this.onceEvents) {
            client.once(event.name, (...args) => {
                void event.execute(...args)
            })
        }

        for (const event of this.recurringEvents) {
            client.on(event.name, (...args) => {
                void event.execute(...args)
            })
        }

    }
}