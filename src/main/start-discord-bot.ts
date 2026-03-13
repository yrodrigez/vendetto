import { InvitesStartedWorkflow } from "@/application/workflows/invites-started/invites-started.workflow";
import { CommandRegistry } from "@/infrastructure/discord/commands/command.registry";
import { InvitesStartedCommand } from "@/infrastructure/discord/commands/impl/invites-started.command";
import { PingCommand } from "@/infrastructure/discord/commands/impl/ping.command";
import { getDiscordClient } from "@/infrastructure/discord/discord-api.adapter";
import { SupabaseRaidResetRepository } from "@/infrastructure/persistance/repositories/raid-reset/supabase-raid-reset.repository";
import { createContainer } from "./workflows-container";
import { interactionCreateEvent } from "@/events/interactionCreate";
import { readyEvent } from "@/events/ready";
import { Events } from "discord.js";
export async function startCommands() {
    const {
        processDeliveryUseCase,
        workflowRepository,
        workflowSchedulerRepository
    } = createContainer();

    const raidResetRepository = new SupabaseRaidResetRepository();

    const invitesStartedWorkflow = new InvitesStartedWorkflow(
        raidResetRepository,
        processDeliveryUseCase,
        workflowRepository,
        workflowSchedulerRepository
    );

    const invitesStartedCommand = new InvitesStartedCommand(invitesStartedWorkflow);
    const pingCommand = new PingCommand();

    const commandRegistry = new CommandRegistry();
    commandRegistry.register(invitesStartedCommand);
    commandRegistry.register(pingCommand);

    const client = await getDiscordClient();
    await commandRegistry.applyToClient(client);

    client.on(Events.InteractionCreate, (interaction) => interactionCreateEvent.execute(interaction));
    client.once(Events.ClientReady, (c) => readyEvent.execute(c));

    console.log(`Commands and Events registered to client`);
}
