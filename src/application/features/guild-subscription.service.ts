import { SubscriptionType } from "./feature.types";


const GUILD_SUBSCRIPTIONS: Record<string, SubscriptionType> = {
    // '817085358248165398': 'free', // DEV (SUDKODE)
    '702280986993492088': 'premium'
}

export class GuildSubscriptionService {
    getSubscription(guildId: string): SubscriptionType {
        if (!guildId) {
            return 'not-registered' as SubscriptionType;
        }

        return GUILD_SUBSCRIPTIONS[guildId] || 'not-registered' as SubscriptionType;
    }
}