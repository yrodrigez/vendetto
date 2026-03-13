SELECT 
    raid_id, 
    details->>'status' AS status, 
    details->>'role' AS role, 
    COUNT(*) AS count
FROM public.ev_raid_participant
WHERE raid_id = ANY($1::uuid[])
GROUP BY raid_id, status, role;
