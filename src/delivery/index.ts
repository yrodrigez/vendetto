import { ProcessDeliveryUseCase } from "../application/usecases/delivery/ProcessDeliveryUseCase";
import { DiscordDeliveryAdapter } from "../infrastructure/discord/discord-delivery-adapter";
import { SupabaseBroadlogRepository } from "../infrastructure/persistance/delivery/SupabaseBroadlogRepository";
import { SupabaseUrlRepository } from "../infrastructure/persistance/delivery/SupabaseUrlRepository";
import { DeliveryParams } from "../domain/delivery/models";

export async function createDelivery({
    id,
    target,
    targetData = {},
    message,
    targetMapping
}: DeliveryParams) {
    const messageSender = new DiscordDeliveryAdapter();
    const broadlogRepository = new SupabaseBroadlogRepository();
    const urlRegistration = new SupabaseUrlRepository();

    const processDeliveryUseCase = new ProcessDeliveryUseCase(
        messageSender,
        broadlogRepository,
        urlRegistration
    );

    async function send({ removeDelay }: { removeDelay?: boolean } = {}) {
        return await processDeliveryUseCase.execute({
            id,
            target,
            targetData,
            message,
            targetMapping
        }, { removeDelay });
    }

    return {
        send
    }
}