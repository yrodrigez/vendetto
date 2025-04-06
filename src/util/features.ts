interface Feature {
    enabled: boolean;
    description: string;
    name: symbol;
}

const getAllFeatures = function () {
    return {
        sendPrivateMessage: {
            enabled: true,
            description:
                'Send private messages to guild members',
            name:
                Symbol('sendPrivateMessage')
        },
        raidNotifications: {
            enabled: true,
            description:
                'Receive notifications for upcoming raids',
            name:
                Symbol('raidNotifications')

        },
        announceConnection: {
            enabled: true,
            description:
                'Announces when the bot connects to the server',
            name:
                Symbol('announceConnection')
        },
        syncGuildMembers: {
            enabled: true,
            description:
                'Sync guild members with the bot',
            name:
                Symbol('syncGuildMembers')
        }
    } as { [key: string]: Feature };
}

const getGuildSubscription = (guildId: string): 'free' | 'basic' | 'premium' | 'dev' => {
    const subscriptions: { [key: string]: 'free' | 'basic' | 'premium' | 'dev' } = {
        '817085358248165398': 'dev', // DEV (SUDKODE)
        '702280986993492088': 'premium'  // Everlasting Vendetta
    };

    return subscriptions[guildId] || 'free';
}


const getEnabledFeatures = (guildId: string) => {

    const subscription = getGuildSubscription(guildId);
    const features = getAllFeatures();

    switch (subscription) {
        case 'free':
            features.sendPrivateMessage.enabled = false;
            features.raidNotifications.enabled = false;
            features.announceConnection.enabled = false;
            break;
        case 'basic':
            features.sendPrivateMessage.enabled = false;
            features.raidNotifications.enabled = false;
            features.announceConnection.enabled = false;
            break;
        case 'premium':
            features.sendPrivateMessage.enabled = false;
            features.raidNotifications.enabled = true;
            features.announceConnection.enabled = false;
            features.syncGuildMembers.enabled = true;
            break;
        case 'dev':
            features.raidNotifications.enabled = false;
            features.announceConnection.enabled = false;
            break;
    }

    return features;
};

export function hasFeature(feature: string, guildId: string): boolean {
    const features = guildId ? getEnabledFeatures(guildId) : {};
    return features[feature] && features[feature].enabled;
}