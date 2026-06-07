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
import { MemberRolesRepository } from "@/infrastructure/persistance/repositories/member-roles/member-roles.repository";
import { RaidReminderCandidateRepository } from "@/infrastructure/persistance/repositories/raid-reminder-candidate/raid-reminder-candidate.repository";
import { SupabaseRaidResetRepository } from "@/infrastructure/persistance/repositories/raid-reset/supabase-raid-reset.repository";
import { RaidSignupNotifierRepository } from "@/infrastructure/persistance/repositories/raid-signup-notifier/raid-signup-notifier.repository";
import { WorkflowExecutionRepository } from "@/infrastructure/persistance/repositories/workflows/workflow-execution.repository";
import { WorkflowRepository } from "@/infrastructure/persistance/repositories/workflows/workflow.repository";

import { PredictionMarketBuilderAgent } from "@/adapters/ai/agents/prediction-market-builder/prediction-market-builder.agent";
import { FindCandidatesForClassRoleUseCase } from "@/application/usecases/discord/find-candidates-for-class-role.usecase";
import { FindDiscordNicknameCandidatesUseCase } from "@/application/usecases/discord/find-discord-nickname-candidates.usecase";
import { FindMembersShouldBeInGuildRoleUsecase } from "@/application/usecases/discord/find-members-should-be-in-guild-role.usecase";
import { InsertDiscordMembersUseCase } from "@/application/usecases/discord/insert-discord-members.usecase";
import { InsertUsersInRoleUsecase } from "@/application/usecases/discord/insert-users-in-role.usecase";
import { RemoveUsersFromRoleUsecase } from "@/application/usecases/discord/remove-users-from-role.usecase";
import { UpdateDiscordNicknameToCharacterNameUseCase } from "@/application/usecases/discord/update-discord-nickname.usecase";
import { CreatePredictionMarketUseCase } from "@/application/usecases/prediction-markets/create-prediction-market.usecase";
import { FindPredictionMarketsByResetIdUseCase } from "@/application/usecases/prediction-markets/find-prediction-markets-by-reset-id.usecase";
import { GetPopularPredictionMarketsUseCase } from "@/application/usecases/prediction-markets/get-popular-prediction-markets.usecase";
import { GetUpcomingResetsUseCase } from "@/application/usecases/raid-resets/get-upcoming-resets.usecase";
import { VercelAiNewsDigestGenerationAdapter } from "@/infrastructure/ai/vercel-ai-news-digest-generation.adapter";
import { NsfwSoundDetectClientFactory } from "@/infrastructure/audio/nsfw-sound-detect.client";
import { BisSearchService } from "@/infrastructure/bis-search.service";
import { DiscordChannelAdapter } from "@/infrastructure/discord/discord-channel.adapter";
import { DiscordPlayerAdapter } from "@/infrastructure/discord/discord-player.adapter";
import { VoiceModerationRegistry } from "@/infrastructure/discord/voice-moderation-registry";
import { EvApiService } from "@/infrastructure/ev-api.service";
import { OllamaService } from "@/infrastructure/ollama.service";
import { SeedMemberRepository } from "@/infrastructure/persistance/delivery/seed-membner.repository";
import { DeliveryRepository } from "@/infrastructure/persistance/delivery/supabase-delivery.repository";
import { DiscordMembersRepository } from "@/infrastructure/persistance/repositories/discord-members/discord-members.repository";
import { PredictionMarketsRepository } from "@/infrastructure/persistance/repositories/evx/prediction-markets.repository";
import { LootHistoryRepository } from "@/infrastructure/persistance/repositories/loot-history-news/loot-history-news.repository";
import { MembersRepository } from "@/infrastructure/persistance/repositories/members/members.repository";
import { RaidParticipantWebEventsRepository } from "@/infrastructure/persistance/repositories/raid-participant-action-events/raid-participant-web-events.repository";
import { ResetChannelRepository } from "@/infrastructure/persistance/repositories/reset-channel/reset-channel.repository";
import { ResetMessagesRepository } from "@/infrastructure/persistance/repositories/reset-messages/reset-messages.repository";
import { ResetParticipantRepository } from "@/infrastructure/persistance/repositories/reset-participant/reset-participant.repository";
import { SuggestSrRepository } from "@/infrastructure/persistance/repositories/suggest-sr/suggest-sr.repository";
import { UsersRepository } from "@/infrastructure/persistance/repositories/users/users.repository";
import { ResetMessagesRealtimeSubscription } from "@/infrastructure/supabase/reset-messages-realtime.subscription";
import { ExecutePredictionMarketAgentUseCase } from "@/application/usecases/agents/execute-prediction-market-agent.usecase";
import { WorkflowsCleanupUseCase } from "@/application/usecases/cleanup/workflows-cleanup.usecase";

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
    const raidParticipantActionEventsRepository = new RaidParticipantWebEventsRepository(databaseClient);
    const memberRolesRepository = new MemberRolesRepository(databaseClient);
    const raidResetRepository = new SupabaseRaidResetRepository();
    const deliveryRepository = new DeliveryRepository();
    const membersRepository = new MembersRepository(databaseClient);
    const backendAPIService = new EvApiService();
    const findMembersShouldBeInGuildRoleUsecase = new FindMembersShouldBeInGuildRoleUsecase(
        membersRepository,
        discordApi,
        backendAPIService
    );
    const insertUsersInRoleUsecase = new InsertUsersInRoleUsecase(discordApi);
    const removeUsersFromRoleUsecase = new RemoveUsersFromRoleUsecase(discordApi);
    const findCandidatesForClassRoleUseCase = new FindCandidatesForClassRoleUseCase(membersRepository, discordApi);

    const updateDiscordNicknameToCharacterNameUseCase = new UpdateDiscordNicknameToCharacterNameUseCase(discordApi);
    const findDiscordNicknameCandidatesUseCase = new FindDiscordNicknameCandidatesUseCase(candidateRepository);
    const seedMemberRepository = new SeedMemberRepository(databaseClient);
    const discordMembersRepository = new DiscordMembersRepository(databaseClient);
    const usersRepository = new UsersRepository(databaseClient);

    const insertDiscordMembersUseCase = new InsertDiscordMembersUseCase(
        discordApi,
        discordMembersRepository,
        usersRepository,
        membersRepository,
    );

    const discordChannelAdapter = new DiscordChannelAdapter();
    const resetChannelRepository = new ResetChannelRepository(databaseClient);
    const resetMessagesRepository = new ResetMessagesRepository(databaseClient);
    const resetParticipantRepository = new ResetParticipantRepository(databaseClient);
    const resetMessagesRealtimeSubscription = new ResetMessagesRealtimeSubscription(
        discordChannelAdapter,
        resetChannelRepository,
        databaseClient,
    );

    const discordPlayerAdapter = new DiscordPlayerAdapter();

    const suggestSrRepository = new SuggestSrRepository(databaseClient);
    const ollamaService = new OllamaService();
    const bisSearchService = new BisSearchService();

    const nsfwDetectWsUrl = process.env.NSFW_DETECT_WS_URL ?? 'ws://localhost:8081/v1/audio:stream';
    const nsfwTargetLabels = (process.env.NSFW_TARGET_LABELS ?? 'Fart, Burping, eructation')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    const nsfwScoreThreshold = Number(process.env.NSFW_SCORE_THRESHOLD ?? '0.65');
    const nsfwDetectorFactory = new NsfwSoundDetectClientFactory(nsfwDetectWsUrl);
    const voiceModerationRegistry = new VoiceModerationRegistry();
    const lootHistoryRepository = new LootHistoryRepository(databaseClient);
    const newsDigestGenerationAdapter = new VercelAiNewsDigestGenerationAdapter();

    const predictionMarketRepository = new PredictionMarketsRepository(databaseClient);
    const predictionMarketUseCase = new CreatePredictionMarketUseCase(predictionMarketRepository);
    const findPredictionMarketsByResetIdUseCase = new FindPredictionMarketsByResetIdUseCase(predictionMarketRepository);
    const getPopularPredictionMarketsUseCase = new GetPopularPredictionMarketsUseCase(predictionMarketRepository);

    const getUpcomingResetsUseCase = new GetUpcomingResetsUseCase(raidResetRepository);

    const predictionMarketBuilderAgent = new PredictionMarketBuilderAgent({
        createPredictionMarketUseCase: predictionMarketUseCase,
        findPredictionMarketsByResetIdUseCase: findPredictionMarketsByResetIdUseCase,
        getPopularPredictionMarketsUseCase: getPopularPredictionMarketsUseCase,
        model: 'claude-sonnet-4-6',
    });

    const executePredictionMarketAgentUseCase = new ExecutePredictionMarketAgentUseCase(predictionMarketBuilderAgent, findPredictionMarketsByResetIdUseCase);

    const workflowCleanupUseCase = new WorkflowsCleanupUseCase(workflowExecutionRepository);

    return {
        workflowCleanupUseCase,
        executePredictionMarketAgentUseCase,
        predictionMarketBuilderAgent,
        getUpcomingResetsUseCase,
        findPredictionMarketsByResetIdUseCase,
        getPopularPredictionMarketsUseCase,
        predictionMarketUseCase,
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
        raidParticipantActionEventsRepository,
        memberRolesRepository,
        raidResetRepository,
        updateDiscordNicknameToCharacterNameUseCase,
        findDiscordNicknameCandidatesUseCase,
        deliveryRepository,
        seedMemberRepository,
        membersRepository,
        backendAPIService,
        findMembersShouldBeInGuildRoleUsecase,
        insertUsersInRoleUsecase,
        removeUsersFromRoleUsecase,
        findCandidatesForClassRoleUseCase,
        insertDiscordMembersUseCase,
        discordMembersRepository,
        discordChannelAdapter,
        resetChannelRepository,
        resetMessagesRepository,
        resetParticipantRepository,
        resetMessagesRealtimeSubscription,
        discordPlayerAdapter,
        suggestSrRepository,
        ollamaService,
        bisSearchService,
        nsfwDetectorFactory,
        nsfwTargetLabels,
        nsfwScoreThreshold,
        voiceModerationRegistry,
        lootHistoryRepository,
        newsDigestGenerationAdapter,
    }
}
