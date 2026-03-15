import { InvitesStartedCommand } from "@/application/commands/invites-started.command";
import { OffPushToTalkCommand } from "@/application/commands/off-push-to-talk.command";
import { PingCommand } from "@/application/commands/ping.command";
import { StartPushToTalkCommand } from "@/application/commands/start-push-to-talk.command";
import { InteractionCreateEvent } from "@/application/events/interaction-create.event";
import { ReadyEvent } from "@/application/events/ready.event";
import { InvitesStartedWorkflow } from "@/application/workflows/discord/invites-started/invites-started.workflow";
import { CommandRegistry } from "@/infrastructure/discord/commands/command.registry";
import { getDiscordClient, getGuilds } from "@/infrastructure/discord/discord-api.adapter";
import { EventsRegistry } from "@/infrastructure/discord/events/events.registry";
import { createContainer } from "./workflows-container";
import { UpdateUserNicknameOnMemberJoinEvent } from "@/application/events/update-user-nickname-on-login.event";

export async function startCommands() {
    const {
        processDeliveryUseCase,
        workflowRepository,
        workflowSchedulerRepository,
        guildFeaturePolicyService,
        memberRolesRepository,
        logger,
        raidResetRepository,
        findDiscordNicknameCandidatesUseCase,
        updateDiscordNicknameToCharacterNameUseCase,
        deliveryRepository
    } = createContainer();

    const client = await getDiscordClient();
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

    eventsRegistry.applyToClient(client);

    const commandRegistry = new CommandRegistry();
    const guilds = await getGuilds()
    for (const guild of guilds.values()) {
        if (guildFeaturePolicyService.isFeatureEnabled(guild.id, "raidInvitesNotifications")) {
            const invitesStartedWorkflow = new InvitesStartedWorkflow(
                raidResetRepository,
                processDeliveryUseCase,
                workflowRepository,
                workflowSchedulerRepository,
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

    await commandRegistry.applyToClient(client);

    console.log(`Commands and Events registered to client`);
}
