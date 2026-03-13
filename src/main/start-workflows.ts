import { SyncDiscordNicknamesWorkflow } from "@/application/workflows/discord/sync-discord-nicknames.workflow";
import { WorkflowSchedulerService } from "@/application/workflows/workflow-scheduler.service";
import { getGuilds } from "@/infrastructure/discord/discord-api.adapter";
import { createContainer } from "./workflows-container";
import { RaidReminderWorkflow } from "@/application/workflows/raid-reminder/raid-reminder.workflow";
import seedList from "@/seeds";


export async function startWorkflows() {
    const {
        discordApi,
        candidateRepository,
        workflowRepository,
        workflowSchedulerRepository,
        guildFeaturePolicyService,
        logger,
        raidReminderCandidateRepository,
        processDeliveryUseCase,
        broadlogRepo,
        urlRepo,
        discordAdapter
    } = createContainer()

    const guilds = await getGuilds()
    const scheduler = new WorkflowSchedulerService(workflowSchedulerRepository)

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
            const workflow = new RaidReminderWorkflow(
                raidReminderCandidateRepository,
                processDeliveryUseCase,
                logger,
                workflowRepository,
                workflowSchedulerRepository,
                guild.id
            )

            await scheduler.registerWorkflow(workflow, { guildId: guild.id, seedList })
            console.log(`Registered workflow "${workflow.name}" for guild ${guild.id}`)
        }
    }

    scheduler.start()
}
