WITH recent_active_members AS (
    SELECT DISTINCT m.id as member_id, m.user_id as user_id, m.character as character
    FROM public.ev_raid_participant rp
    JOIN ev_member m ON m.id = rp.member_id
    WHERE (rp.created_at >= NOW() - $1::interval
       OR m.created_at >= NOW() - $1::interval ) AND m.is_selected = true
)
, next_upcoming_raid AS (
    SELECT 
    rr.id, 
    r.name, 
    rr.raid_date, 
    rr.time,
    (rr.raid_date + rr.time) AS raid_datetime
    FROM public.raid_resets rr
    INNER JOIN public.ev_raid r ON r.id = rr.raid_id
    WHERE (raid_date+time) > NOW() + '12 hours'::interval
      AND (raid_date+time) < NOW() + '1 week'::interval
      AND (status IS NULL OR (status != 'offline' AND status != 'locked'))
      AND (r.size > (SELECT count(1) FROM public.ev_raid_participant rp WHERE rp.raid_id = rr.id))
    ORDER BY (raid_date+time)
    LIMIT 1
)
, next_reset_boundary AS (
    SELECT
        nur.raid_datetime,
        CASE
            WHEN extract(isodow from nur.raid_datetime) < 3 THEN
                date_trunc('day', nur.raid_datetime)
                + make_interval(days => (3 - extract(isodow from nur.raid_datetime))::int)
            ELSE
                date_trunc('day', nur.raid_datetime)
                + make_interval(days => (10 - extract(isodow from nur.raid_datetime))::int)
        END AS next_reset_datetime
    FROM next_upcoming_raid nur
)
, next_raid_signups AS (
    SELECT DISTINCT member_id
    FROM public.ev_raid_participant
    WHERE raid_id = (SELECT id FROM next_upcoming_raid)
)
, already_notified AS (
    SELECT "to"
    FROM open_campaign.broadlog
    CROSS JOIN next_upcoming_raid
    WHERE communication_code = $2::text || '_' || next_upcoming_raid.id::text
      AND created_at::date >= NOW() - $3::interval
      AND last_event = 'success'
)
, user_registered_in_raid_until_next_reset AS (
  SELECT DISTINCT rp.member_id
    FROM public.ev_raid_participant rp
    JOIN public.raid_resets rr ON rp.raid_id = rr.id
    JOIN public.ev_raid r ON r.id = rr.raid_id
    CROSS JOIN next_upcoming_raid nur
    CROSS JOIN next_reset_boundary nrb
    WHERE r.name = nur.name
      AND (rr.raid_date + rr.time) > nur.raid_datetime
      AND (rr.raid_date + rr.time) < nrb.next_reset_datetime
)
SELECT op.provider_user_id as discord_id,
        am.character->>'name' as name,
        0 as account_id,
        ((r.raid_date + r.time) AT TIME ZONE $4::text) AS raid_date,
        r.name AS raid_name,
        r.id AS raid_id
FROM recent_active_members am
INNER JOIN ev_auth.oauth_providers op ON op.user_id = am.user_id
CROSS JOIN next_upcoming_raid r
WHERE op.provider_user_id NOT IN (SELECT "to" FROM already_notified)
  AND am.member_id NOT IN (SELECT member_id FROM next_raid_signups)
  AND op.provider LIKE '%discord%'
  AND am.member_id NOT IN (SELECT member_id FROM user_registered_in_raid_until_next_reset)
UNION
SELECT DISTINCT dm.discord_user_id AS discord_id,
                m.character ->> 'name' AS name,
                m.wow_account_id AS account_id,
                ((r.raid_date + r.time) AT TIME ZONE $4::text) AS raid_date,
                r.name AS raid_name,
                r.id AS raid_id
FROM public.discord_members dm
CROSS JOIN next_upcoming_raid r
JOIN public.ev_member m ON dm.member_id = m.id
WHERE m.id IN (SELECT member_id FROM recent_active_members)
  AND m.id NOT IN (SELECT member_id FROM next_raid_signups)
  AND dm.discord_user_id NOT IN (SELECT "to" FROM already_notified)
  AND m.id NOT IN (SELECT member_id FROM user_registered_in_raid_until_next_reset)
ORDER BY name;
