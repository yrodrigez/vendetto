# Everlasting Vendetta Discord Bot

A Discord bot for the "Everlasting Vendetta" guild.

## Setup

1. Install Node.js (version 16.9.0 or higher)
2. Clone this repository
3. Run `npm install` to install dependencies
4. Create a `config.json` file with your bot token and IDs
5. Run `npm run deploy` to register the slash commands
6. Run `npm start` to start the bot

### Config File

Make sure your config.json has:
- Your bot token from the [Discord Developer Portal](https://discord.com/developers/applications)
- Your bot's client ID
- Your Everlasting Vendetta guild ID

## Features

- `/ping` - Check if bot is online
- `/guildinfo` - Display information about the guild
- `/member [user]` - Get information about a guild member
- `/announce [channel] [title] [message]` - Create an announcement (Admin only)
- `/dm [users] [message]` - Send a direct message to one or more users (Admin only)

Examples:

```
/announce channel:#news title:Raid Tonight message:Raid tonight at 20:00 server time!
/announce channel:news, general title:Maintenance message:Server restart in 10 minutes
/dm users:@Alice, @Bob message:Don't forget to sign up for tonight's raid!
```

For `/announce`, `channel` is a comma-separated list of channel names (e.g. `#news`) or `#mentions`. Leave it blank to post in the current channel. For `/dm`, `users` is a comma-separated list of `@mentions` or usernames. Both commands require the `Administrator` or `ManageMessages` Discord permission.

## Adding More Commands

To add more commands, create new files in the `commands` directory.
