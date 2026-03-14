import { DiscordCommand } from "@/infrastructure/discord/commands/command.interface";
import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlags, MessageFlags, PermissionFlagsBits } from "discord.js";
import threadPool from "@/util/thread-pool";
import { MemberRolesRepositoryPort } from "@/application/ports/outbound/member-roles-repository.port";

export class StartPushToTalkCommand implements DiscordCommand {
    private readonly allowedRoles = [
        'ADMIN',
        'GUILD_MASTER',
        'RAID_LEADER',
    ];

    constructor(
        private readonly memberRolesRepository: MemberRolesRepositoryPort
    ) { }

    public data = new SlashCommandBuilder()
        .setName('ptt-on')
        .setDescription('Starts the push to talk workflow for all users in the current channel');

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
            content: `Starting push to talk workflow for all users in this channel (${channel.id}/${channel.toString()})...`,
            flags: MessageFlags.Ephemeral,
        })

        const members = channel.members;
        console.log(`Found ${members.size} members in channel ${channel.name} (${channel.id})`)


        for await (const member of channel.members.values()) {
            if (member.user.bot) {
                console.log(`Skipping bot member ${member.user.tag} (${member.id}) in channel ${channel.name} (${channel.id})`)
                continue;
            }

            if (member.id === interaction.user.id) {
                console.log(`Skipping command user ${member.user.tag} (${member.id}) in channel ${channel.name} (${channel.id})`)
                continue;
            }
            console.log(`Enabling push to talk for member ${member.user.tag} (${member.id}) in channel ${channel.name} (${channel.id})`)
            const overwrite = channel.permissionOverwrites.cache.get(member.id);
            const hasSpeakDeny = overwrite?.deny.has(PermissionFlagsBits.UseVAD) ?? false;
            if (!hasSpeakDeny) {
                await threadPool.submit(async () => {
                    await channel.permissionOverwrites.edit(member.id, {
                        UseVAD: false,
                        //use sounds also off
                        UseSoundboard: false,
                    }, { reason: 'Enabling push to talk for member' });
                    console.log(`Enabled push to talk for member ${member.user.tag} (${member.id}) in channel ${channel.name} (${channel.id})`)
                })
            } else {
                console.log(`Member ${member.user.tag} (${member.id}) in channel ${channel.name} (${channel.id}) already has push to talk enabled`)
            }
        }

        await interaction.followUp({
            content: 'Push to talk workflow started for all users in this channel!',
            flags: MessageFlags.Ephemeral,
        })

    }
}