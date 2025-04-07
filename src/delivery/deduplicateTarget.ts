/**
 * Deduplicates an array of targets based on their Discord IDs
 * Filters out invalid Discord IDs (non-numeric strings)
 */
export function deduplicateTarget(target: { discordId: string }[]): { discordId: string }[] {
    if (!target || !Array.isArray(target) || target.length === 0) {
        return [];
    }

    const validTargets = target.filter(item =>
        item && item.discordId &&
        typeof item?.discordId === 'string' &&
        /^\d+$/.test(item.discordId)
    );

    const uniqueMap = new Map<string, { discordId: string }>();

    validTargets.forEach(item => {
        uniqueMap.set(item.discordId, item);
    });

    return Array.from(uniqueMap.values());
}