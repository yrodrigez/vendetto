import { DatabaseClient } from "@/infrastructure/database/db";

export interface MemberInfo {
    memberId: number;
    characterName: string;
}

export interface MemberRoleInfo {
    role: string;
    className: string;
}

export interface ItemStats {
    itemLevel?: number;
    armor?: number;
    dps?: string;
    stats?: string[];
    equips?: string[];
    sockets?: string[];
    socketBonus?: string;
    classes?: string[];
}

export interface UnreceivedItem {
    id: number;
    name: string;
    itemClass: string;
    itemSubclass: string;
    inventoryType: string;
    quality: number;
    qualityName: string;
    icon: string;
    bossName: string;
    phase: number;
    raidName: string;
    parsedStats: ItemStats;
}

const QUALITY_NAMES: Record<number, string> = {
    0: 'Poor',
    1: 'Common',
    2: 'Uncommon',
    3: 'Rare',
    4: 'Epic',
    5: 'Legendary',
};

// Raid IDs mapped to phases
const PHASE_RAIDS: Record<number, string[]> = {
    1: [
        'dc024bb3-4951-4251-afe5-bc47e04eb50d', // Karazhan
        '491b48ca-4e12-4a84-9ac1-d2cdfcfb57e8', // Gruul & Magtheridon Lairs
        '21955526-5b19-4e6d-8dff-a6948f4cf78c', // Magtheridon's Lair
        '5d9c7212-fd3d-40ea-a16c-5d243744907e', // Gruul's Lair
    ],
    2: [
        '7836e1a8-5c1e-4c33-b3dd-39c5fd73e298', // Tempest Keep
        'aeee5b9c-c69b-49de-ac14-76083a5ed3c4', // Serpentshrine Cavern
    ],
    3: [
        'b67f3063-4218-41f2-aed6-ba234d54d2b3', // Black Temple
        'b086760a-b6d5-40eb-a624-31322a59fc13', // Hyjal
    ],
    4: [
        '38d584c5-36a3-4cfc-ba6e-27e1208311a4', // Zul'Aman
    ],
    5: [
        '1cf7e82c-f61a-487e-a47a-58ccc48f7cbc', // Sunwell Plateau
    ],
};

function getRaidIdsForPhase(maxPhase: number): string[] {
    const ids: string[] = [];
    for (let p = 1; p <= maxPhase; p++) {
        if (PHASE_RAIDS[p]) ids.push(...PHASE_RAIDS[p]);
    }
    return ids;
}

function getPhaseForRaidId(raidId: string | null): number {
    if (!raidId) return 0;
    for (const [phase, ids] of Object.entries(PHASE_RAIDS)) {
        if (ids.includes(raidId)) return parseInt(phase);
    }
    return 0;
}

function parseTooltip(tooltip: string | null): ItemStats {
    const stats: ItemStats = {};
    if (!tooltip) return stats;

    try {
        // Item Level
        const ilvlMatch = tooltip.match(/Item Level\s*(?:<!--ilvl-->)?(\d+)/);
        if (ilvlMatch) stats.itemLevel = parseInt(ilvlMatch[1]);

        // Armor
        const armorMatch = tooltip.match(/<!--amr-->(\d+)\s*Armor/);
        if (armorMatch) stats.armor = parseInt(armorMatch[1]);

        // DPS
        const dpsMatch = tooltip.match(/\(([\d.]+)\s*damage per second\)/);
        if (dpsMatch) stats.dps = dpsMatch[1];

        // Primary/secondary stats like +44 Strength, +41 Stamina
        const statMatches = tooltip.matchAll(/<!--stat\d+-->\+(\d+)\s+(\w+)/g);
        const statList: string[] = [];
        for (const m of statMatches) {
            statList.push(`+${m[1]} ${m[2]}`);
        }
        if (statList.length > 0) stats.stats = statList;

        // Equip effects like "Improves hit rating by 31", "Increases attack power by 84"
        const equipMatches = tooltip.matchAll(/Equip:\s*(?:<!--[^>]*-->)?(?:<[^>]*>)*(.*?)<\/a>/g);
        const equipList: string[] = [];
        for (const m of equipMatches) {
            const cleaned = m[1].replace(/<[^>]*>/g, '').replace(/<!--[^>]*-->/g, '').trim();
            if (cleaned) equipList.push(cleaned);
        }
        if (equipList.length > 0) stats.equips = equipList;

        // Sockets
        const socketMatches = tooltip.matchAll(/class="socket-(\w+)[^"]*"[^>]*>(\w+ Socket)/g);
        const socketList: string[] = [];
        for (const m of socketMatches) {
            socketList.push(m[2]);
        }
        if (socketList.length > 0) stats.sockets = socketList;

        // Socket bonus
        const sbMatch = tooltip.match(/Socket Bonus:\s*(?:<[^>]*>)*(.*?)(?:<\/|$)/);
        if (sbMatch) {
            const cleaned = sbMatch[1].replace(/<[^>]*>/g, '').replace(/<!--[^>]*-->/g, '').trim();
            if (cleaned) stats.socketBonus = cleaned;
        }

        // Class restrictions
        const classMatch = tooltip.match(/Classes:\s*(.*?)<\/div>/);
        if (classMatch) {
            const classNames = classMatch[1].match(/class="c\d+">(.*?)<\/a>/g);
            if (classNames) {
                stats.classes = classNames.map(c => c.replace(/<[^>]*>/g, ''));
            }
        }
    } catch {
        // Parsing is best-effort — never fail the whole query
    }

    return stats;
}

export class SuggestSrRepository {
    constructor(private readonly databaseClient: DatabaseClient) {}

    async getMemberByDiscordId(discordUserId: string): Promise<MemberInfo | null> {
        const query = `
            SELECT m.id AS member_id, m.character->>'name' AS character_name
            FROM ev_auth.oauth_providers op
            JOIN ev_member m ON m.user_id = op.user_id
            WHERE op.provider LIKE '%discord%'
              AND op.provider_user_id = $1
              AND m.is_selected = true
            UNION
            SELECT m.id AS member_id, m.character->>'name' AS character_name
            FROM discord_members dm
            JOIN ev_member m ON m.id = dm.member_id
            WHERE dm.discord_user_id = $1
              AND m.is_selected = true
            LIMIT 1
        `;
        const results = await this.databaseClient.query<{ member_id: number; character_name: string }>(query, [discordUserId]);
        if (results.length === 0) return null;
        return { memberId: results[0].member_id, characterName: results[0].character_name };
    }

    async getMemberRoleInfo(memberId: number): Promise<MemberRoleInfo | null> {
        const query = `
            SELECT details->>'role' AS role, details->>'className' AS class_name
            FROM ev_raid_participant
            WHERE member_id = $1
              AND (details->>'status' IS NULL OR details->>'status' != 'declined')
            ORDER BY updated_at DESC
            LIMIT 1
        `;
        const results = await this.databaseClient.query<{ role: string; class_name: string }>(query, [memberId]);
        if (results.length === 0) return null;
        return { role: results[0].role, className: results[0].class_name };
    }

    async getUnreceivedItems(characterName: string): Promise<UnreceivedItem[]> {
        const maxPhase = parseInt(process.env.TBC_CURRENT_PHASE || '5', 10);
        const raidIds = getRaidIdsForPhase(maxPhase);

        if (raidIds.length === 0) return [];

        // Build placeholders for raid IDs ($2, $3, $4, ...)
        const raidPlaceholders = raidIds.map((_, i) => `$${i + 2}`).join(', ');

        const query = `
            SELECT rli.id,
                   rli.name,
                   rli.description->>'itemClass' AS item_class,
                   rli.description->>'itemSubclass' AS item_subclass,
                   rli.description->>'inventoryType' AS inventory_type,
                   (rli.description->>'quality')::int AS quality,
                   rli.description->>'icon' AS icon,
                   rli.description->>'tooltip' AS tooltip,
                   b.name AS boss_name,
                   rl.raid_id
            FROM raid_loot rl
            JOIN raid_loot_item rli ON rli.id = rl.item_id
            LEFT JOIN bosses_items bi ON bi.item_id = rli.id
            LEFT JOIN bosses b ON b.id = bi.boss_id
            WHERE rl.raid_id IN (${raidPlaceholders})
              AND rli.id NOT IN (
                SELECT "itemID" FROM ev_loot_history WHERE lower("character") = lower($1)
            )
            ORDER BY rli.description->>'inventoryType', rli.id
            LIMIT 20
        `;
        const results = await this.databaseClient.query<{
            id: number; name: string; item_class: string; item_subclass: string;
            inventory_type: string; quality: number; icon: string; tooltip: string;
            boss_name: string; raid_id: string;
        }>(query, [characterName, ...raidIds]);
        return results.map(row => ({
            id: row.id,
            name: row.name,
            itemClass: row.item_class,
            itemSubclass: row.item_subclass,
            inventoryType: row.inventory_type,
            quality: row.quality,
            qualityName: QUALITY_NAMES[row.quality] || 'Unknown',
            icon: row.icon,
            bossName: row.boss_name || 'Unknown',
            phase: getPhaseForRaidId(row.raid_id),
            raidName: row.raid_id ? this.getRaidName(row.raid_id) : 'Unknown',
            parsedStats: parseTooltip(row.tooltip),
        }));
    }

    private getRaidName(raidId: string): string {
        const RAID_NAMES: Record<string, string> = {
            'dc024bb3-4951-4251-afe5-bc47e04eb50d': 'Karazhan',
            '491b48ca-4e12-4a84-9ac1-d2cdfcfb57e8': 'Gruul & Magtheridon',
            '21955526-5b19-4e6d-8dff-a6948f4cf78c': "Magtheridon's Lair",
            '5d9c7212-fd3d-40ea-a16c-5d243744907e': "Gruul's Lair",
            '7836e1a8-5c1e-4c33-b3dd-39c5fd73e298': 'Tempest Keep',
            'aeee5b9c-c69b-49de-ac14-76083a5ed3c4': 'Serpentshrine Cavern',
            'b67f3063-4218-41f2-aed6-ba234d54d2b3': 'Black Temple',
            'b086760a-b6d5-40eb-a624-31322a59fc13': 'Hyjal',
            '38d584c5-36a3-4cfc-ba6e-27e1208311a4': "Zul'Aman",
            '1cf7e82c-f61a-487e-a47a-58ccc48f7cbc': 'Sunwell Plateau',
        };
        return RAID_NAMES[raidId] || 'Unknown';
    }
}
