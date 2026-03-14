import { GuildFeaturePolicyService } from "@/application/features/guild-feature-policy.service";
import { DiscordEvent } from "@/infrastructure/discord/events/event.interface";
import { ChannelType, Client, ClientEvents, Events, TextChannel } from 'discord.js';

export class ReadyEvent implements DiscordEvent {
    public readonly name: keyof ClientEvents = Events.ClientReady;
    public readonly once = true;

    constructor(
        private readonly featuresService: GuildFeaturePolicyService,
    ) { }

    async execute(client: Client): Promise<void> {
        await client.guilds.fetch();

        const guilds = client.guilds.cache.filter(guild => {
            return this.featuresService.isFeatureEnabled(guild.id, "announceConnection");
        });

        if (guilds.size === 0) {
            console.log("No guilds with announceConnection feature");
            return;
        }

        for (const guild of guilds.values()) {
            const channel = guild.channels.cache.find(channel => {
                return channel.type === ChannelType.GuildText && (channel.name === 'vendetto-system');
            }) as TextChannel | undefined;

            if (channel && channel.send) {
                await channel.send("Vendetto ready to serve!");
            } else {
                console.log(`No channel found in guild ${guild.id}`);
            }
        }
    }
}