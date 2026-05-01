import { FeatureConfig, FeatureName } from "./feature.types";

const CATALOG: Record<FeatureName, FeatureConfig> = {
    updateNicknameToCharacterNickname: {
        description: 'Update Discord nickname to match the character name',
    },
    sendPrivateMessage: {
        description: 'Send private messages to guild members'
    },
    raidNotifications: {
        description: 'Receive notifications for upcoming raids'
    },
    announceConnection: {
        description: "Announces when the bot connects to the server"
    },
    syncGuildMembers: {
        description: "Sync guild members with the bot"
    },
    raidInvitesNotifications: {
        description: "Receive notifications for raid invites"
    },
    campaigns: {
        description: "Campaigns"
    },
    syncClassRoles: {
        description: "Sync class roles"
    },
    raidChannelSync: {
        description: "Sync raids to channels"
    },
    closeReservations: {
        description: "Automatically close reservations that are past their reservation time and notify users"
    }
}

export default CATALOG;