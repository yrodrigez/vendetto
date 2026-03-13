export type SubscriptionType = 'free' | 'premium';

export type FeatureName =
    | 'updateNicknameToCharacterNickname'
    | 'sendPrivateMessage'
    | 'raidNotifications'
    | 'announceConnection'
    | 'syncGuildMembers'
    | 'raidInvitesNotifications'
    | 'campaigns'


export type FeatureConfig = {
    description: string
}