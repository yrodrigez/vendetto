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
- `/announce [channel] [message]` - Create an announcement (Admin only)

## Adding More Commands

To add more commands, create new files in the `commands` directory.
