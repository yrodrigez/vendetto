import { GuildFeaturePolicyService } from "@/application/features/guild-feature-policy.service";
import { GuildSubscriptionService } from "@/application/features/guild-subscription.service";
import { ProcessDeliveryUseCase } from "@/application/usecases/delivery/ProcessDeliveryUseCase";
import { DatabaseClient } from "@/infrastructure/database/db";
import { DiscordApiAdapter } from "@/infrastructure/discord/discord-api.adapter";
import { DiscordDeliveryAdapter } from "@/infrastructure/discord/discord-delivery-adapter";
import { LogChannelEntry } from "@/infrastructure/discord/log-channel-entry";
import { SupabaseBroadlogRepository } from "@/infrastructure/persistance/delivery/supabase-broadlog.repository";
import { SupabaseUrlRepository } from "@/infrastructure/persistance/delivery/supabase-url.repository";
import { DiscordNicknameCandidateRepository } from "@/infrastructure/persistance/repositories/discord-nickname-candidate/discord-nickname-candidate-repository";
import { RaidReminderCandidateRepository } from "@/infrastructure/persistance/repositories/raid-reminder-candidate/raid-reminder-candidate.repository";
import { WorkflowRepository } from "@/infrastructure/persistance/repositories/workflows/workflow.repository";
import { WorkflowExecutionRepository } from "@/infrastructure/persistance/repositories/workflows/workflow-execution.repository";
import { RaidSignupNotifierRepository } from "@/infrastructure/persistance/repositories/raid-signup-notifier/raid-signup-notifier.repository";
import { MemberRolesRepository } from "@/infrastructure/persistance/repositories/member-roles/member-roles.repository";
import { SupabaseRaidResetRepository } from "@/infrastructure/persistance/repositories/raid-reset/supabase-raid-reset.repository";
import { UpdateDiscordNicknameToCharacterNameUseCase } from "@/application/usecases/discord/update-discord-nickname.usecase";
import { FindDiscordNicknameCandidatesUseCase } from "@/application/usecases/discord/find-discord-nickname-candidates.usecase";
import { DeliveryRepository } from "@/infrastructure/persistance/delivery/supabase-delivery.repository";
import { SeedMemberRepository } from "@/infrastructure/persistance/delivery/seed-membner.repository";

export function createContainer() {
    const guildSubscriptionService = new GuildSubscriptionService();
    const guildFeaturePolicyService = new GuildFeaturePolicyService(guildSubscriptionService);
    const discordApi = new DiscordApiAdapter();
    const databaseClient = new DatabaseClient();
    const candidateRepository = new DiscordNicknameCandidateRepository(databaseClient);
    const workflowExecutionRepository = new WorkflowExecutionRepository(databaseClient);
    const workflowRepository = new WorkflowRepository(databaseClient);
    const logger = new LogChannelEntry() // You would implement this port to log messages to a specific Discord channel
    const raidReminderCandidateRepository = new RaidReminderCandidateRepository(databaseClient);
    const broadlogRepo = new SupabaseBroadlogRepository();
    const urlRepo = new SupabaseUrlRepository();
    const discordAdapter = new DiscordDeliveryAdapter();
    const processDeliveryUseCase = new ProcessDeliveryUseCase(discordAdapter, broadlogRepo, urlRepo);
    const raidSignupNotifierRepository = new RaidSignupNotifierRepository(databaseClient);
    const memberRolesRepository = new MemberRolesRepository(databaseClient);
    const raidResetRepository = new SupabaseRaidResetRepository();
    const deliveryRepository = new DeliveryRepository();

    const updateDiscordNicknameToCharacterNameUseCase = new UpdateDiscordNicknameToCharacterNameUseCase(discordApi);
    const findDiscordNicknameCandidatesUseCase = new FindDiscordNicknameCandidatesUseCase(candidateRepository);
    const seedMemberRepository = new SeedMemberRepository(databaseClient);

    return {
        guildSubscriptionService,
        guildFeaturePolicyService,
        discordApi,
        candidateRepository,
        databaseClient,
        workflowExecutionRepository,
        workflowRepository,
        logger,
        raidReminderCandidateRepository,
        processDeliveryUseCase,
        broadlogRepo,
        urlRepo,
        discordAdapter,
        raidSignupNotifierRepository,
        memberRolesRepository,
        raidResetRepository,
        updateDiscordNicknameToCharacterNameUseCase,
        findDiscordNicknameCandidatesUseCase,
        deliveryRepository,
        seedMemberRepository
    }
}