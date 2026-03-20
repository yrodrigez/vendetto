import { FeatureName } from "./feature.types";
import { GuildSubscriptionService } from "./guild-subscription.service";

export class GuildFeaturePolicyService {

    constructor(
        private readonly guildSubscriptionService: GuildSubscriptionService = new GuildSubscriptionService(),
        private readonly freeFeatures: FeatureName[] = [
            'announceConnection',
            'updateNicknameToCharacterNickname',
            'syncGuildMembers',
            'syncClassRoles'
        ],
        private readonly premiumFeatures: FeatureName[] = [
            'raidNotifications',
            'raidInvitesNotifications',
            'campaigns',
            'sendPrivateMessage',
        ]
    ) { }
    isFeatureEnabled(guildId: string, featureName: FeatureName): boolean {
        const subscription = this.guildSubscriptionService.getSubscription(guildId);
        switch (subscription) {
            case 'not-registered':
                return false;
            case 'free':
                return this.freeFeatures.includes(featureName);
            case 'premium':
                return this.premiumFeatures.includes(featureName) || this.freeFeatures.includes(featureName);
        }
        return false;
    }
}