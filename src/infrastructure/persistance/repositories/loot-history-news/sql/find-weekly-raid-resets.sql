SELECT
    rr.id::text AS reset_id,
    r.name AS raid_name,
    rr.raid_date,
    rr.time::text AS raid_time,
    (rr.raid_date + rr.time) AS raid_datetime,
    rr.status
FROM public.raid_resets rr
INNER JOIN public.ev_raid r ON r.id = rr.raid_id
WHERE (rr.raid_date + rr.time) >= $1::timestamp
  AND (rr.raid_date + rr.time) <= NOW()
  AND (rr.status IS NULL OR rr.status != 'offline')
ORDER BY raid_datetime ASC;
