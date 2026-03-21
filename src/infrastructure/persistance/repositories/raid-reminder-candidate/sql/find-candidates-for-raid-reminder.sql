WITH recent_active_members AS (
    SELECT DISTINCT m.id as member_id, m.user_id as user_id, m.character as character
    FROM public.ev_raid_participant rp
    JOIN ev_member m ON m.id = rp.member_id
    WHERE (rp.created_at >= NOW() - '21 days'::interval
       OR m.created_at >= NOW() - '21 days'::interval ) AND m.is_selected = true
)
, upcoming_resets AS (
    SELECT
        rr.id,
        r.name,
        rr.raid_date,
        rr.time,
        (rr.raid_date + rr.time) AS raid_datetime,
        CASE
            WHEN extract(isodow from (rr.raid_date + rr.time)) < 3 THEN
                date_trunc('day', (rr.raid_date + rr.time))
                + make_interval(days => (3 - extract(isodow from (rr.raid_date + rr.time)))::int)
            ELSE
                date_trunc('day', (rr.raid_date + rr.time))
                + make_interval(days => (10 - extract(isodow from (rr.raid_date + rr.time)))::int)
        END AS next_reset_datetime
    FROM public.raid_resets rr
    INNER JOIN public.ev_raid r ON r.id = rr.raid_id
    WHERE (rr.raid_date + rr.time) > NOW() + '12 hours'::interval
      AND (rr.raid_date + rr.time) < NOW() + '1 week'::interval
      AND (rr.status IS NULL OR (rr.status != 'offline' AND rr.status != 'locked'))
      AND r.size > (SELECT count(1) FROM public.ev_raid_participant rp WHERE rp.raid_id = rr.id AND rp.details->>'status' = 'confirmed')
    ORDER BY rr.raid_date, rr.time
)
, member_reset_candidates AS (
    SELECT
        am.member_id,
        am.user_id,
        am.character,
        ur.id AS raid_id,
        ur.name AS raid_name,
        ur.raid_date,
        ur.time,
        ur.raid_datetime
    FROM recent_active_members am
    CROSS JOIN upcoming_resets ur
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.ev_raid_participant rp
        JOIN public.raid_resets rr ON rp.raid_id = rr.id
        JOIN public.ev_raid r ON r.id = rr.raid_id
        WHERE rp.member_id = am.member_id
          AND r.name = ur.name
          AND (rr.raid_date + rr.time) >= NOW()
          AND (rr.raid_date + rr.time) <= ur.next_reset_datetime
    )
)
, first_candidate_per_member AS (
    SELECT DISTINCT ON (member_id)
        member_id, user_id, character,
        raid_id, raid_name, raid_date, time, raid_datetime
    FROM member_reset_candidates
    ORDER BY member_id, raid_datetime
)
, already_notified AS (
    SELECT bl."to", bl.communication_code
    FROM open_campaign.broadlog bl
    JOIN upcoming_resets ur ON bl.communication_code = $1::text || '_' || ur.id::text
    WHERE bl.created_at::date >= NOW() - '2 days'::interval
      AND bl.last_event = 'success'
)
SELECT
    op.provider_user_id AS discord_id,
    fc.character->>'name' AS name,
    ((fc.raid_date + fc.time) AT TIME ZONE 'Europe/Madrid'::text) AS raid_date,
    fc.raid_name AS raid_name,
    fc.raid_id AS raid_id
FROM first_candidate_per_member fc
INNER JOIN ev_auth.oauth_providers op ON op.user_id = fc.user_id
WHERE op.provider LIKE '%discord%'
  AND NOT EXISTS (
      SELECT 1 FROM already_notified an
      WHERE an."to" = op.provider_user_id
        AND an.communication_code = $1::text || '_' || fc.raid_id::text
  )
UNION
SELECT DISTINCT
    dm.discord_user_id AS discord_id,
    fc.character->>'name' AS name,
    ((fc.raid_date + fc.time) AT TIME ZONE 'Europe/Madrid'::text) AS raid_date,
    fc.raid_name AS raid_name,
    fc.raid_id AS raid_id
FROM first_candidate_per_member fc
JOIN public.discord_members dm ON dm.member_id = fc.member_id
WHERE NOT EXISTS (
    SELECT 1 FROM already_notified an
    WHERE an."to" = dm.discord_user_id
      AND an.communication_code = $1::text || '_' || fc.raid_id::text
)
ORDER BY name;
