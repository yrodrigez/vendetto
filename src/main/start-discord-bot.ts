import { InvitesStartedCommand } from "@/application/commands/invites-started.command";
import { OffPushToTalkCommand } from "@/application/commands/off-push-to-talk.command";
import { PingCommand } from "@/application/commands/ping.command";
import { PlayCommand } from "@/application/commands/play.command";
import { QueueCommand } from "@/application/commands/queue.command";
import { SkipCommand } from "@/application/commands/skip.command";
import { StartPushToTalkCommand } from "@/application/commands/start-push-to-talk.command";
import { StopCommand } from "@/application/commands/stop.command";
import { VolumeCommand } from "@/application/commands/volume.command";
import { SuggestSrCommand } from "@/application/commands/suggest-sr.command";
import { InteractionCreateEvent } from "@/application/events/interaction-create.event";
import { ReadyEvent } from "@/application/events/ready.event";
import { InvitesStartedWorkflow } from "@/application/workflows/discord/invites-started/invites-started.workflow";
import { CommandRegistry } from "@/infrastructure/discord/commands/command.registry";
import { getDiscordClient, getGuilds } from "@/infrastructure/discord/discord-api.adapter";
import { EventsRegistry } from "@/infrastructure/discord/events/events.registry";
import { UpdateUserNicknameOnMemberJoinEvent } from "@/application/events/update-user-nickname-on-login.event";
import { ResetChannelMessageEvent } from "@/infrastructure/discord/events/reset-channel-message.event";
import { createContainer } from "./di-container";

export async function startCommands() {
    const {
        processDeliveryUseCase,
        workflowRepository,
        workflowExecutionRepository,
        guildFeaturePolicyService,
        memberRolesRepository,
        logger,
        raidResetRepository,
        findDiscordNicknameCandidatesUseCase,
        updateDiscordNicknameToCharacterNameUseCase,
        deliveryRepository,
        resetChannelRepository,
        resetMessagesRepository,
        resetMessagesRealtimeSubscription,
        databaseClient,
        discordPlayerAdapter,
        suggestSrRepository,
        ollamaService,
        bisSearchService,
    } = createContainer();

    const client = await getDiscordClient();
    await discordPlayerAdapter.initialize();

    const eventsRegistry = new EventsRegistry();

    const readyEvent = new ReadyEvent(guildFeaturePolicyService);
    eventsRegistry.register(readyEvent);

    const interactionCreate = new InteractionCreateEvent(logger);
    eventsRegistry.register(interactionCreate);

    const updateNicknameEvent = new UpdateUserNicknameOnMemberJoinEvent(
        findDiscordNicknameCandidatesUseCase,
        updateDiscordNicknameToCharacterNameUseCase,
        logger
    );
    eventsRegistry.register(updateNicknameEvent);

    const resetChannelMessageEvent = new ResetChannelMessageEvent(
        resetChannelRepository,
        resetMessagesRepository,
        databaseClient,
    );
    eventsRegistry.register(resetChannelMessageEvent);

    eventsRegistry.applyToClient(client);

    resetMessagesRealtimeSubscription.subscribe();

    const commandRegistry = new CommandRegistry();
    const guilds = await getGuilds()
    for (const guild of guilds.values()) {
        if (guildFeaturePolicyService.isFeatureEnabled(guild.id, "raidInvitesNotifications")) {
            const invitesStartedWorkflow = new InvitesStartedWorkflow(
                raidResetRepository,
                processDeliveryUseCase,
                workflowExecutionRepository,
                workflowRepository,
                guild.id,
                deliveryRepository
            );
            const invitesStartedCommand = new InvitesStartedCommand(invitesStartedWorkflow, guildFeaturePolicyService, memberRolesRepository);
            commandRegistry.register(invitesStartedCommand);
        }
    }

    const startPushToTalkCommand = new StartPushToTalkCommand(memberRolesRepository);
    commandRegistry.register(startPushToTalkCommand);

    const offPushToTalkCommand = new OffPushToTalkCommand(memberRolesRepository);
    commandRegistry.register(offPushToTalkCommand);

    const pingCommand = new PingCommand();
    commandRegistry.register(pingCommand);

    const playCommand = new PlayCommand(discordPlayerAdapter);
    commandRegistry.register(playCommand);

    const skipCommand = new SkipCommand(discordPlayerAdapter);
    commandRegistry.register(skipCommand);

    const stopCommand = new StopCommand(discordPlayerAdapter);
    commandRegistry.register(stopCommand);

    const queueCommand = new QueueCommand(discordPlayerAdapter);
    commandRegistry.register(queueCommand);

    const volumeCommand = new VolumeCommand(discordPlayerAdapter);
    commandRegistry.register(volumeCommand);

    const suggestSrCommand = new SuggestSrCommand(suggestSrRepository, ollamaService, bisSearchService);
    commandRegistry.register(suggestSrCommand);

    await commandRegistry.applyToClient(client);

    console.log(`Commands and Events registered to client`);
}
