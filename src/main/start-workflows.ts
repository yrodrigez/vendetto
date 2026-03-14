import { SyncDiscordNicknamesWorkflow } from "@/application/workflows/discord/sync-discord-nicknames.workflow";
import { WorkflowSchedulerService } from "@/application/workflows/workflow-scheduler.service";
import { getGuilds } from "@/infrastructure/discord/discord-api.adapter";
import { createContainer } from "./workflows-container";
import { RaidReminderWorkflow } from "@/application/workflows/raid-reminder/raid-reminder.workflow";

import { RaidSignupNotifierWorkflow } from "@/application/workflows/raid-signup-notifier/raid-signup-notifier.workflow";


export async function startWorkflows() {
    const {
        discordApi,
        candidateRepository,
        workflowRepository,
        workflowSchedulerRepository,
        guildFeaturePolicyService,
        logger,
        processDeliveryUseCase,
        raidSignupNotifierRepository,
        raidReminderCandidateRepository,
        deliveryRepository,
        seedMemberRepository
    } = createContainer()


    const scheduler = new WorkflowSchedulerService(workflowSchedulerRepository, logger)

    const guilds = await getGuilds()
    const seeds = await seedMemberRepository.findAll();
    for (const guild of guilds.values()) {
        if (guildFeaturePolicyService.isFeatureEnabled(guild.id, 'updateNicknameToCharacterNickname')) {
            const workflow = new SyncDiscordNicknamesWorkflow(
                candidateRepository,
                discordApi,
                workflowRepository,
                workflowSchedulerRepository,
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
                workflowRepository,
                workflowSchedulerRepository,
                guild.id,
                deliveryRepository
            )
            await scheduler.registerWorkflow(raidReminderWorkflow, { guildId: guild.id, seedList: seeds })
            console.log(`Registered workflow "${raidReminderWorkflow.name}" for guild ${guild.id}`)

            const raidSignupNotifierWorkflow = new RaidSignupNotifierWorkflow(
                raidSignupNotifierRepository,
                processDeliveryUseCase,
                workflowRepository,
                workflowSchedulerRepository,
                guild.id,
                deliveryRepository
            )
            await scheduler.registerWorkflow(raidSignupNotifierWorkflow, { seedList: seeds })
            console.log(`Registered workflow "${raidSignupNotifierWorkflow.name}" for guild ${guild.id}`)
        }
    }

    scheduler.start()
}
