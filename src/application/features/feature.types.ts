export type SubscriptionType = 'free' | 'premium' | 'not-registered';

export type FeatureName =
    | 'updateNicknameToCharacterNickname'
    | 'sendPrivateMessage'
    | 'raidNotifications'
    | 'announceConnection'
    | 'syncGuildMembers'
    | 'syncClassRoles'
    | 'raidInvitesNotifications'
    | 'campaigns'
    | 'raidChannelSync'
    | 'closeReservations';


export type FeatureConfig = {
    description: string
}