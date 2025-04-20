import {Events, Client, ChannelType, TextChannel} from 'discord.js';
import {hasFeature} from "../util/features.js";

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client: Client) {
        await client.guilds.fetch();

        const guilds = client.guilds.cache.filter(guild => {
            return hasFeature("announceConnection", guild.id);
        });

        if (guilds.size === 0) {
            console.log("No guilds with announceConnection feature");
            return;
        }

        for (const guild of guilds.values()) {
            const channel = guild.channels.cache.find(channel => {
                return channel.type === ChannelType.GuildText && (channel.name === 'announcements' || channel.name === 'general');
            }) as TextChannel | undefined;

            if (channel && channel.send) {
                await channel.send("Bot is ready and connected!");
            } else {
                console.log(`No channel found in guild ${guild.id}`);
            }
        }
    }
}