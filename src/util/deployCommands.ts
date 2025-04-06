import {REST, Routes, type Client, type Collection} from 'discord.js'

export async function deployCommands(token: string, clientId: string, commands: Collection<string, any>, client: Client) {
    const rest = new REST({version: '10'}).setToken(token);

    try {
        console.log(`Started refreshing ${commands.size} application (/) commands.`);
        await client.guilds.fetch();
        const commandsData = [...commands.values()].map(c => c.data ? c.data.toJSON() : c);
        await Promise.all(client.guilds.cache.map(async ({id}) => {
            try {
                await rest.put(
                    Routes.applicationGuildCommands(clientId, id),
                    {body: commandsData},
                )
            } catch (e) {
                console.error(`Error fetching guild ${id}`, e)
            }
        }));
        console.log('Successfully deployed commands to all guilds');
    } catch (error) {
        console.error(error);
    }
}