import {Events, Client, TextChannel} from 'discord.js';

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(channels: {[key: string]: string}, client: Client) {
    console.log(`Ready! Logged in as ${client?.user?.tag}`);
    const channel = client.channels.cache.get(channels.general);
    if (channel && (channel instanceof TextChannel)) {
      await channel.send("I am ready to serve you, my lord!");
    } else {
      console.error("Channel is not a text channel or not found");
    }

  },
};