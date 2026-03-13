import { GuildFeaturePolicyService } from "@/application/features/guild-feature-policy.service";
import { GuildSubscriptionService } from "@/application/features/guild-subscription.service";
import { ProcessDeliveryUseCase } from "@/application/usecases/delivery/ProcessDeliveryUseCase";
import { DatabaseClient } from "@/infrastructure/database/db";
import { DiscordApiAdapter } from "@/infrastructure/discord/discord-api.adapter";
import { DiscordDeliveryAdapter } from "@/infrastructure/discord/discord-delivery-adapter";
import { LogChannelEntry } from "@/infrastructure/discord/log-channel-entry";
import { SupabaseBroadlogRepository } from "@/infrastructure/persistance/delivery/SupabaseBroadlogRepository";
import { SupabaseUrlRepository } from "@/infrastructure/persistance/delivery/SupabaseUrlRepository";
import { DiscordNicknameCandidateRepository } from "@/infrastructure/persistance/repositories/discord-nickname-candidate/discord-nickname-candidate-repository";
import { RaidReminderCandidateRepository } from "@/infrastructure/persistance/repositories/raid-reminder-candidate/raid-reminder-candidate.repository";
import { WorkflowSchedulerRepository } from "@/infrastructure/persistance/repositories/workflows/workflow-scheduler.repository";
import { WorkflowsRepository } from "@/infrastructure/persistance/repositories/workflows/workflows.repository";
import { RaidSignupNotifierRepository } from "@/infrastructure/persistance/repositories/raid-signup-notifier/raid-signup-notifier.repository";

export function createContainer() {
    const guildSubscriptionService = new GuildSubscriptionService();
    const guildFeaturePolicyService = new GuildFeaturePolicyService(guildSubscriptionService);
    const discordApi = new DiscordApiAdapter();
    const databaseClient = new DatabaseClient();
    const candidateRepository = new DiscordNicknameCandidateRepository(databaseClient);
    const workflowRepository = new WorkflowsRepository(databaseClient);
    const workflowSchedulerRepository = new WorkflowSchedulerRepository(databaseClient);
    const logger = new LogChannelEntry() // You would implement this port to log messages to a specific Discord channel
    const raidReminderCandidateRepository = new RaidReminderCandidateRepository(databaseClient);
    const broadlogRepo = new SupabaseBroadlogRepository();
    const urlRepo = new SupabaseUrlRepository();
    const discordAdapter = new DiscordDeliveryAdapter();
    const processDeliveryUseCase = new ProcessDeliveryUseCase(discordAdapter, broadlogRepo, urlRepo);
    const raidSignupNotifierRepository = new RaidSignupNotifierRepository(databaseClient);


    return {
        guildSubscriptionService,
        guildFeaturePolicyService,
        discordApi,
        candidateRepository,
        databaseClient,
        workflowRepository,
        workflowSchedulerRepository,
        logger,
        raidReminderCandidateRepository,
        processDeliveryUseCase,
        broadlogRepo,
        urlRepo,
        discordAdapter,
        raidSignupNotifierRepository
    }
}