import { getEnvironment } from "../environment";


export type RosterCharacter = {
    "id": number,
    "wow_account_id": number,
    "name": string,
    "realm"?: {
        "slug"?: string
    },
    "level": number,
    "last_login_timestamp": number,
    "character_class"?: {
        "name"?: string,
    },
    "guild"?: {
        "name"?: string
    },
    "avatar"?: string,
}

export class EvApiService {
    constructor(
        private readonly baseUrl: string = getEnvironment().evApi.baseUrl,
        private readonly token: string = getEnvironment().evApi.token,
    ) { }

    async getRoster(): Promise<RosterCharacter[]> {
        const response = await fetch(`${this.baseUrl}/api/wow/roster`, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const { roster } = await response.json();

        if (!roster?.length) {
            throw new Error('No roster found');
        }

        return roster.map((entry: any) => ({
            id: entry.id,
            wow_account_id: entry.wow_account_id,
            name: entry.name,
            realm: entry.realm,
            level: entry.level,
            last_login_timestamp: entry.last_login_timestamp,
            character_class: entry.character_class,
            guild: entry.guild,
            avatar: entry.avatar,
        }));
    }
}