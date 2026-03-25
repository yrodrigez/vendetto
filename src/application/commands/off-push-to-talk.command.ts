import { DiscordCommand } from "@/infrastructure/discord/commands/command.interface";
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import threadPool from "@/util/thread-pool";
import { MemberRolesRepositoryPort } from "@/application/ports/outbound/database/member-roles-repository.port";

export class OffPushToTalkCommand implements DiscordCommand {
    private readonly allowedRoles = [
        'ADMIN',
        'GUILD_MASTER',
        'RAID_LEADER',
    ];

    constructor(
        private readonly memberRolesRepository: MemberRolesRepositoryPort
    ) { }

    public data = new SlashCommandBuilder()
        .setName('ptt-off')
        .setDescription('Stops the push to talk for all users in the current channel');

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const channel = interaction.channel;

        if (!channel?.isVoiceBased()) {
            await interaction.reply({
                content: 'This command can only be used in a voice channel',
                flags: MessageFlags.Ephemeral,
            })
            return;
        }

        const userId = interaction.user.id;
        const userRoles = await this.memberRolesRepository.findRolesForMember(userId);
        const hasRole = userRoles.some(role => this.allowedRoles.includes(role));
        if (!hasRole) {
            await interaction.reply({
                content: 'You do not have permission to use this command',
                flags: MessageFlags.Ephemeral,
            })
            return;
        }

        await interaction.reply({
            content: `Stopping push to talk workflow for all users in this channel...`,
            flags: MessageFlags.Ephemeral,
        })

        for await (const member of channel.members.values()) {
            await threadPool.submit(async () => {
                await channel.permissionOverwrites.edit(member.id, {
                    UseVAD: true,
                    UseSoundboard: true,
                }, { reason: 'Disabling push to talk for member' });
            })
        }

        await interaction.followUp({
            content: 'Push to talk workflow stopped for all users in this channel!',
            flags: MessageFlags.Ephemeral,
        })

    }
}