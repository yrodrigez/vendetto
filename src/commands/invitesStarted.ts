import {ChatInputCommandInteraction, type Client, SlashCommandBuilder} from "discord.js";
import {hasFeature} from "../util/features";
import {getUserRoles} from "../util/userPermissions";
import {createServerComponentClient} from "../supabase";

const allowedRoles = [
    'GUILD_MASTER',
    'RAID_LEADER',
    'LOOT_MASTER',
];

export const data = new SlashCommandBuilder()
    .setName('invitesstarted')
    .setDescription('Sends a message when raids invites start for specified raids')
    .addStringOption(option =>
        option.setName('reset_id')
            .setDescription('The ID of the reset to send invites for')
            .setRequired(true)
    )

export async function execute(interaction: ChatInputCommandInteraction) {
    console.log('Invites started command executed');
    const guildId = interaction.guildId;
    if (!guildId) {
        console.error('Guild ID not found');
        return;
    }
    if (!hasFeature('raidInvitesNotifications', guildId)) {
        await interaction.reply({
            content: 'This feature is not available for your server',
            ephemeral: true,
        });
        return;
    }

    const resetId = interaction.options.getString('reset_id');
    if (!resetId) {
        await interaction.reply({
            content: 'Please provide a reset ID',
            ephemeral: true,
        });
        return;
    }

    const userId = interaction.user.id;
    const roles = await getUserRoles(userId)
    const hasRole = roles.some(role => allowedRoles.includes(role));

    if (!hasRole) {
        await interaction.reply({
            content: 'You do not have permission to use this command',
            ephemeral: true,
        });
        return;
    }

    await interaction.deferReply();

    const participants = await findParticipants(resetId);
    if (participants.length === 0) {
        await interaction.reply({
            content: 'No participants found for this reset',
            ephemeral: true,
        });
        return;
    }

    const results = {
        successful: [] as string[],
        failed: [] as string[]
    };

    for (const participant of participants) {
        try {
            if (participant.id) {
                await sendInviteMessage(interaction.client, participant.id, participant.name, participant.raidName, resetId);
                results.successful.push(participant.name || "Unknown");
            } else {
                results.failed.push(participant.name || "Unknown");
            }
        } catch (error) {
            console.error(`Failed to send message to ${participant.name}:`, error);
            results.failed.push(participant.name || "Unknown");
        }
    }

    // Provide feedback about the operation
    let responseMessage = `📣 Raid invites for reset ${resetId}:\n`;
    responseMessage += `✅ Successfully notified: ${results.successful.length} members\n ${
        results.successful.join(', ')
    }`;

    if (results.failed.length > 0) {
        responseMessage += `❌ Failed to notify: ${results.failed.length} members (they may have DMs disabled)\n ${results.failed.join(', ')}`;
    }

    await interaction.editReply({
        content: responseMessage
    });

}

async function findParticipants(resetId: string) {
    const supabase = createServerComponentClient()
    const {data: participants, error} = await supabase
        .from('ev_raid_participant')
        .select('member_id, raid:raid_resets!inner(name, raid_date)')
        .eq('raid_id', resetId)
        .gte('raid_resets.raid_date', new Date().toISOString())
        .neq('details->>status', 'declined')
        .neq('details->>status', 'benched')

    if (error) {
        console.error('Error fetching participants', error);
        return [];
    }

    if (!participants.length) {
        return []
    }

    const {data: discordUsers, error: discordError} = await supabase
        .from('discord_members')
        .select('*')
        .in('member_id', participants.map(p => p.member_id))

    if (discordError) {
        console.error('Error fetching discord users', discordError);
        return [];
    }


    return discordUsers.map(user => ({
        id: user.discord_user_id,
        name: user.name,
        //@ts-ignore
        raidName: participants[0].raid.name
    }));
}

async function sendInviteMessage(client: Client, userId: string, name: string, raidName: string, raidId: string): Promise<void> {
    try {
        const user = await client.users.fetch(userId);
        await user.send({
            content: `🔔 Splish Splash! Invites Started! 🔔\n\nHey ${name}, it's me, Vendetto, your favorite eight-armed friend! 🐙\n\nInvites for ${raidName} have just begun—time to dive in!\n\nLog in quick, I'm juggling invites with all my arms waiting for you! 🌊✨\n\nQuick reminder: Don't forget to review your Soft Reserves (SRs) here 👉 [Review SRs](https://www.everlastingvendetta.com/raid/${raidId}/soft-reserv)`
        });
    } catch (error) {
        // Re-throw the error to be caught by the calling function
        console.log('ERROR HAPPENED*********', name)
        throw error;
    }
}