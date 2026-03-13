import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { DiscordCommand } from "../command.interface";
import { InvitesStartedWorkflow } from "@/application/workflows/invites-started/invites-started.workflow";
import { hasFeature } from "@/util/features";
import { getUserRoles } from "@/util/userPermissions";

const allowedRoles = [
    'ADMIN',
    'GUILD_MASTER',
    'RAID_LEADER',
    'LOOT_MASTER',
];

export class InvitesStartedCommand implements DiscordCommand {
    public data = new SlashCommandBuilder()
        .setName('invitesstarted')
        .setDescription('Sends a message when raids invites start for specified raids')
        .addStringOption(option =>
            option.setName('reset_id')
                .setDescription('The ID of the reset to send invites for')
                .setRequired(true)
        );

    constructor(
        private readonly workflow: InvitesStartedWorkflow
    ) { }

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
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
        const roles = await getUserRoles(userId);
        const hasRole = roles.some(role => allowedRoles.includes(role));
        if (!hasRole) {
            await interaction.reply({
                content: 'You do not have permission to use this command',
                ephemeral: true,
            });
            return;
        }

        await interaction.reply({
            content: `📣 **Raid Invites Delivery Started**\nThe delivery process for reset \`${resetId}\` has been queued and is now running in the background. Invites will be sent momentarily!`,
            ephemeral: false
        });

        // Fire and forget the workflow execution so we don't block or timeout the Discord interaction
        try {
            await this.workflow.execute({ resetId });
        } catch (error: any) {
            console.error(`Error executing InvitesStartedWorkflow for reset ${resetId}:`, error);
            await interaction.followUp({
                content: `Error executing InvitesStartedWorkflow for reset ${resetId}: ${error.message}`,
                ephemeral: true,
            });
        }
    }
}
