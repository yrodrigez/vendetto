SELECT
    lh.raid_id::text AS reset_id,
    r.name AS raid_name,
    rr.raid_date,
    rr.time::text AS raid_time,
    (rr.raid_date + rr.time) AS raid_datetime,
    COALESCE(m.character->>'name', lh.character) AS character_name,
    i.details->>'name' AS item_name,
    lh."dateTime" AS looted_at
FROM public.ev_loot_history lh
LEFT JOIN public.ev_member m ON lower(m.character->>'name') = lower(lh.character)
INNER JOIN public.wow_items i ON i.id = lh."itemID" and i.details->>'name' <> 'Nether Vortex' and i.details->>'name' not like 'Plans: %' and i.details->>'name' not like 'Recipe: %' and i.details->>'name' not like 'Schematic: %' and i.details->>'name' not like 'Formula: %' and i.details->>'name' not like 'Pattern: %'
INNER JOIN public.raid_resets rr ON rr.id = lh.raid_id
INNER JOIN public.ev_raid r ON r.id = rr.raid_id
WHERE lh."dateTime" >= $1::timestamp and lh.character <> '_disenchanted'
ORDER BY raid_datetime ASC, character_name ASC, item_name ASC;
