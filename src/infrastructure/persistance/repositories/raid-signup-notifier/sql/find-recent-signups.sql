SELECT 
    rp.member_id,
    rp.raid_id,
    rp.created_at,
    rp.updated_at,
    rp.details->>'status' AS status,
    rp.details->>'role' AS role,
    rr.raid_date,
    rr.time,
    r.name AS raid_name,
    m.character->>'name' AS character_name,
    m.character->'character_class'->>'name' AS character_class
FROM 
    public.ev_raid_participant rp
    JOIN public.raid_resets rr ON rr.id = rp.raid_id
    JOIN public.ev_raid r ON r.id = rr.raid_id
    JOIN public.ev_member m ON m.id = rp.member_id
WHERE 
    (rp.created_at >= NOW() - ($1 || ' seconds')::interval OR rp.updated_at >= NOW() - ($1 || ' seconds')::interval)
ORDER BY 
    rp.created_at DESC;
