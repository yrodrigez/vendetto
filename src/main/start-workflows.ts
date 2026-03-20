import { SyncDiscordNicknamesWorkflow } from "@/application/workflows/discord/sync-discord-nicknames.workflow/sync-discord-nicknames.workflow";
import { WorkflowSchedulerService } from "@/application/workflows/workflow-scheduler.service";
import { getGuilds } from "@/infrastructure/discord/discord-api.adapter";

import { RaidReminderWorkflow } from "@/application/workflows/discord/raid-reminder/raid-reminder.workflow";

import { RaidSignupNotifierWorkflow } from "@/application/workflows/discord/raid-signup-notifier/raid-signup-notifier.workflow";
import { SyncDiscordGuildRolesWorkflow } from "@/application/workflows/discord/sync-discord-guild-roles.workflow";
import { SyncDiscordClassRolesWorkflow } from "@/application/workflows/discord/sync-discord-class-roles.workflow";
import { createContainer } from "./di-container";
import { InsertDiscordMembersWorkflow } from "@/application/workflows/discord/insert-discord-members.workflow";


export async function startWorkflows() {
    const {
        discordApi,
        candidateRepository,
        workflowRepository,
        workflowExecutionRepository,
        guildFeaturePolicyService,
        logger,
        processDeliveryUseCase,
        raidSignupNotifierRepository,
        raidReminderCandidateRepository,
        deliveryRepository,
        seedMemberRepository,
        insertUsersInRoleUsecase,
        removeUsersFromRoleUsecase,
        findMembersShouldBeInGuildRoleUsecase,
        findCandidatesForClassRoleUseCase,
        insertDiscordMembersUseCase,
    } = createContainer()


    const scheduler = new WorkflowSchedulerService(workflowRepository, logger)

    const guilds = await getGuilds()
    const seeds = await seedMemberRepository.findAll();
    for (const guild of guilds.values()) {
        if (guildFeaturePolicyService.isFeatureEnabled(guild.id, 'updateNicknameToCharacterNickname')) {
            const workflow = new SyncDiscordNicknamesWorkflow(
                candidateRepository,
                discordApi,
                workflowExecutionRepository,
                workflowRepository,
                guild.id,
                logger
            )

            await scheduler.registerWorkflow(workflow, { guildId: guild.id })
            console.log(`Registered workflow "${workflow.name}" for guild ${guild.id}`)
        }

        if (guildFeaturePolicyService.isFeatureEnabled(guild.id, "raidNotifications")) {
            const raidReminderWorkflow = new RaidReminderWorkflow(
                raidReminderCandidateRepository,
                processDeliveryUseCase,
                logger,
                workflowExecutionRepository,
                workflowRepository,
                guild.id,
                deliveryRepository
            )
            await scheduler.registerWorkflow(raidReminderWorkflow, { guildId: guild.id, seedList: seeds })
            console.log(`Registered workflow "${raidReminderWorkflow.name}" for guild ${guild.id}`)

            const raidSignupNotifierWorkflow = new RaidSignupNotifierWorkflow(
                raidSignupNotifierRepository,
                processDeliveryUseCase,
                workflowExecutionRepository,
                workflowRepository,
                guild.id,
                deliveryRepository
            )
            await scheduler.registerWorkflow(raidSignupNotifierWorkflow, { seedList: seeds })
            console.log(`Registered workflow "${raidSignupNotifierWorkflow.name}" for guild ${guild.id}`)
        }
        if (guildFeaturePolicyService.isFeatureEnabled(guild.id, "syncClassRoles")) {
            const syncClassRolesWorkflow = new SyncDiscordClassRolesWorkflow(
                workflowRepository,
                workflowExecutionRepository,
                guild.id,
                findCandidatesForClassRoleUseCase,
                removeUsersFromRoleUsecase,
                insertUsersInRoleUsecase,
                logger
            )
            await scheduler.registerWorkflow(syncClassRolesWorkflow, { guildId: guild.id })
            console.log(`Registered workflow "${syncClassRolesWorkflow.name}" for guild ${guild.id}`)
        }

        if (guildFeaturePolicyService.isFeatureEnabled(guild.id, "syncGuildMembers")) {
            const syncGuildRolesWorkflow = new SyncDiscordGuildRolesWorkflow(
                workflowRepository,
                workflowExecutionRepository,
                guild.id,
                findMembersShouldBeInGuildRoleUsecase,
                removeUsersFromRoleUsecase,
                insertUsersInRoleUsecase,
                logger
            )
            await scheduler.registerWorkflow(syncGuildRolesWorkflow, { guildId: guild.id })
            console.log(`Registered workflow "${syncGuildRolesWorkflow.name}" for guild ${guild.id}`)

            const insertDiscordMembersWorkflow = new InsertDiscordMembersWorkflow(
                workflowRepository,
                workflowExecutionRepository,
                guild.id,
                insertDiscordMembersUseCase,
            )
            await scheduler.registerWorkflow(insertDiscordMembersWorkflow, { guildId: guild.id })
            console.log(`Registered workflow "${insertDiscordMembersWorkflow.name}" for guild ${guild.id}`)
        }
    }

    scheduler.start()
}
