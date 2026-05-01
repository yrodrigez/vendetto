import { RaidResetRepositoryPort } from "@/application/ports/outbound/database/raid-reset.repository.port";
import { ResetChannelRepositoryPort } from "@/application/ports/outbound/database/reset-channel-repository.port";
import { WorkflowRunRepositoryPort } from "@/application/ports/outbound/database/workflow-run-repository.port";
import { WorkflowRepositoryPort } from "@/application/ports/outbound/database/workflow-scheduler-repository.port";
import { DiscordChannelLoggerPort } from "@/application/ports/outbound/discord-channel-logger.port";
import { DiscordChannelPort } from "@/application/ports/outbound/discord-channel.port";

import {
    Retryable,
    Schedule,
    Step,
    WorkflowName,
    WorkflowWithSchedule
} from "@/application/workflows/workflow";
import { getMessage } from "./close-reservations-messages";

export type CloseReservationsWorkflowInput = {
    guildId: string;
}

@WorkflowName('Campaign: Close Reservations')
@Schedule('*/10 19-23 * * *', { isRecurring: true, isRunningOnStartup: true }) // Schedule to run every 10 minutes between 19:00 and 23:59 daily
export class CloseReservationsWorkflow extends WorkflowWithSchedule<CloseReservationsWorkflowInput> {
    private readonly closedReservationsChannels = new Set<{
        channelId: string;
        guildId: string;
        reset: {
            id: string;
            name: string;
        }
    }>();
    constructor(
        private readonly raidResetRepository: RaidResetRepositoryPort,
        private readonly resetChannelRepository: ResetChannelRepositoryPort,
        private readonly discordChannel: DiscordChannelPort,
        private readonly logger: DiscordChannelLoggerPort,
        workflowExecutionRepository: WorkflowRunRepositoryPort,
        workflowRepository: WorkflowRepositoryPort,
        context: string
    ) {
        super(workflowRepository, workflowExecutionRepository, context);
    }

    @Step('close-reservations', 0)
    @Retryable({ maxRetries: 3, delayMs: 1000 })
    async closeReservations() {
        try {
            // Find all open reservations that are 10 minutes past their raid time
            const openReservations = await this.raidResetRepository.findOpenReservations();

            if (!openReservations || openReservations.length === 0) {
                console.log('CloseReservationsWorkflow: No open reservations to close');
                return;
            }

            // Process each open reservation
            for (const reservation of openReservations) {
                try {
                    // Calculate the time when reservations should be closed
                    const raidDateTimeString = `${reservation.raid_date}T${reservation.time}`;
                    const raidDateTime = new Date(raidDateTimeString);
                    const closeTime = new Date(raidDateTime.getTime() + 10 * 60000);

                    // Check if closeTime is in the past
                    const now = new Date();
                    if (closeTime <= now) {
                        // Close the reservation
                        await this.raidResetRepository.updateReservationsClosed(reservation.id);

                        const message = `Reservation for ${reservation.name} has been automatically closed by the system.`;
                        await this.logger.log(this.input.guildId, message);
                        const resetChannel = await this.resetChannelRepository.findByResetId(reservation.id);
                        if (resetChannel) {
                            this.closedReservationsChannels.add({
                                channelId: resetChannel.channelId,
                                guildId: resetChannel.guildId,
                                reset: {
                                    id: reservation.id,
                                    name: reservation.name,
                                }
                            });
                        } else {
                            console.warn(`No channel found for closed reservation ${reservation.id}`);
                            await this.logger.log(this.input.guildId, `No channel found for closed reservation \`${reservation.name}\` and id \`${reservation.id}\``);
                        }
                    }
                } catch (error) {
                    console.error(`Error processing reservation ${reservation.id}:`, error);
                    this.logger.log(this.input.guildId, `Error closing reservations for ${reservation.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    // Continue with other reservations even if one fails
                }
            }
        } catch (error) {
            console.error('Error in close reservations workflow:', error);
            this.logger.log(this.input.guildId, `Error in close reservations workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    @Step('notify-closed-reservations', 1)
    @Retryable({ maxRetries: 3, delayMs: 1000 })
    async notifyClosedReservations() {
        for (const { channelId, reset } of this.closedReservationsChannels) {
            try {
                const message = getMessage(reset.name, reset.id);
                await this.discordChannel.sendMessage(channelId, message);
            } catch (error) {
                console.error(`Error notifying closed reservation for channel ${channelId}:`, error);
                // Continue with other notifications even if one fails
                this.logger.log(this.input.guildId, `Error notifying closed reservation for ${reset.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // Clear the set after processing
        this.closedReservationsChannels.clear();
    }
}