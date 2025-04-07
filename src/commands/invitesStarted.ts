import {ChatInputCommandInteraction, type Client, SlashCommandBuilder} from "discord.js";
import {hasFeature} from "../util/features";
import {getUserRoles} from "../util/userPermissions";
import {createServerComponentClient} from "../supabase";
import {createDelivery} from "../delivery";

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

    const reset = await findRaidReset(resetId);
    if (!reset) {
        await interaction.reply({
            content: 'Invalid reset ID',
            ephemeral: true,
        });
        return;
    }
    const startDate = new Date(reset.raid_date + ' ' + reset.time);
    const endDate = new Date(reset.end_date + ' ' + reset.end_time);
    const now = new Date();

    if (now > endDate) {
        await interaction.reply({
            content: 'This reset has ended',
            ephemeral: true,
        });
        return;
    }

    if (now < startDate) {
        const diff = startDate.getTime() - now.getTime();
        const diffMinutes = Math.floor(diff / 1000 / 60);
        if (diffMinutes > 60) {
            await interaction.reply({
                content: 'This reset is more than 1 hour away',
                ephemeral: true,
            });
            return;
        }
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

    const delivery = await createDelivery({
        client: interaction.client,
        target: participants.map(p => ({discordId: p.id})),
        targetData: {raidName: participants[0]?.raidName ?? '', resetId},
        targetMapping: {targetName: 'user'},
        message: {
            targetMapping: {targetName: 'user'},
            content: `# 🔔 Splish Splash! Invites Started! 🔔
            
            Hey {{{user.displayName}}}, it's me, Vendetto, your favorite eight-armed friend! 🐙
            
            Invites for {{targetData.raidName}} have just begun—time to dive in!
            
            
            Log in quick, I'm juggling invites with all my arms waiting for you! 🌊✨
            
            
            Quick reminder: Don't forget to review your Soft Reserves (SRs) 
            here 👉 [Review SRs](https://www.everlastingvendetta.com/raid/{{{targetData.resetId}}}/soft-reserv)`
        }
    })
    const results = await delivery.send()


    // Provide feedback about the operation
    let responseMessage = `📣 Raid invites for reset ${resetId}:\n`;
    responseMessage += `✅ Successfully notified: ${results.successful.length} members`

    if (results.failed.length > 0) {
        responseMessage += `\n❌ Failed to notify: ${results.failed.length} members (they may have DMs disabled)`;
    }

    await interaction.editReply({
        content: responseMessage
    });
}

async function findRaidReset(resetId: string) {
    const supabase = createServerComponentClient()
    const {data: reset, error} = await supabase
        .from('raid_resets')
        .select('id, name, raid:ev_raid(name, id), raid_date, end_date, time, end_time')
        .eq('id', resetId)
        .single<{
            id: string,
            name: string,
            raid: {
                id: string,
                name: string
            },
            raid_date: string,
            end_date: string,
            time: string,
            end_time: string
        }>()

    if (error) {
        console.error('Error fetching raid reset', error);
        return null;
    }

    return reset;
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