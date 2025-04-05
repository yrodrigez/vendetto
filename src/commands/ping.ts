import {SlashCommandBuilder} from 'discord.js';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    async execute(interaction: any) {
        console.log('Ping command executed');
        try {
            await interaction.reply('Pong!');
        } catch (error) {
            console.error('Error replying to interaction:', error);
            await interaction.followUp({content: 'There was an error while executing this command!', ephemeral: true});
        }
    },
};