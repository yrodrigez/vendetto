import { SubscriptionType } from "./feature.types";


const GUILD_SUBSCRIPTIONS: Record<string, SubscriptionType> = {
    // '817085358248165398': 'free', // DEV (SUDKODE)
    '702280986993492088': 'premium'
}

export class GuildSubscriptionService {
    getSubscription(guildId: string): SubscriptionType {
        if (!guildId) {
            return 'free';
        }

        return GUILD_SUBSCRIPTIONS[guildId] || 'free';
    }
}