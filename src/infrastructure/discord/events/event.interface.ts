import { ClientEvents } from "discord.js";

export interface DiscordEvent {
    name: keyof ClientEvents;
    once?: boolean;
    execute(...args: any[]): Promise<void>;
}