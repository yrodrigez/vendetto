WITH relevant_events AS (
    SELECT
        e.created_at,
        e.event_name,
        e.metadata,
        (e.metadata->>'memberId')::bigint AS member_id,
        e.metadata->>'playerName' AS player_name,
        CASE
            WHEN e.event_name IN ('raid_bench_player', 'raid_unbench_player') THEN e.metadata->>'resetId'
            WHEN e.event_name = 'raid_remove_player' THEN e.metadata->>'raidId'
            WHEN e.event_name = 'move_participant' THEN e.metadata->>'toResetId'
            ELSE NULL
        END AS reset_id,
        CASE WHEN e.event_name = 'move_participant' THEN e.metadata->>'fromResetId' ELSE NULL END AS from_reset_id,
        CASE WHEN e.event_name = 'move_participant' THEN e.metadata->>'toResetId' ELSE NULL END AS to_reset_id
    FROM public.web_events e
    WHERE e.created_at >= NOW() - ($1 || ' seconds')::interval
      AND e.event_name IN ('raid_remove_player', 'raid_bench_player', 'raid_unbench_player', 'move_participant')
      AND e.metadata ? 'memberId'
), resolved_members AS (
    SELECT
        re.created_at,
        re.event_name,
        re.member_id,
        re.player_name,
        re.reset_id,
        re.from_reset_id,
        re.to_reset_id,
        COALESCE(op.provider_user_id, dm.discord_user_id) AS discord_user_id,
        COALESCE(m.character->>'name', dm.name, re.player_name, 'raider') AS member_name
    FROM relevant_events re
    LEFT JOIN public.ev_member m ON m.id = re.member_id
    LEFT JOIN LATERAL (
        SELECT provider_user_id
        FROM ev_auth.oauth_providers
        WHERE user_id = m.user_id
          AND provider LIKE '%discord%'
        LIMIT 1
    ) op ON TRUE
    LEFT JOIN public.discord_members dm ON dm.member_id = re.member_id
), enriched_events AS (
    SELECT
        rm.discord_user_id,
        rm.member_id,
        rm.member_name,
        rm.event_name,
        rm.created_at,
        target_reset.id::text AS reset_id,
        target_raid.name AS raid_name,
        (target_reset.raid_date + target_reset.time)::text AS raid_date,
        rm.from_reset_id,
        from_raid.name AS from_raid_name,
        (from_reset.raid_date + from_reset.time)::text AS from_raid_date,
        rm.to_reset_id,
        to_raid.name AS to_raid_name,
        (to_reset.raid_date + to_reset.time)::text AS to_raid_date
    FROM resolved_members rm
    LEFT JOIN public.raid_resets target_reset ON target_reset.id::text = rm.reset_id
    LEFT JOIN public.ev_raid target_raid ON target_raid.id = target_reset.raid_id
    LEFT JOIN public.raid_resets from_reset ON from_reset.id::text = rm.from_reset_id
    LEFT JOIN public.ev_raid from_raid ON from_raid.id = from_reset.raid_id
    LEFT JOIN public.raid_resets to_reset ON to_reset.id::text = rm.to_reset_id
    LEFT JOIN public.ev_raid to_raid ON to_raid.id = to_reset.raid_id
    WHERE rm.discord_user_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM open_campaign.broadlog bl
          WHERE bl."to" = rm.discord_user_id
            AND bl.communication_code = 'raid_participant_action_notifier'
            AND bl.last_event = 'success'
            AND bl.created_at >= NOW() - ($2 || ' seconds')::interval
      )
), ranked_events AS (
    SELECT
        ee.*,
        row_number() OVER (
            PARTITION BY ee.discord_user_id
            ORDER BY ee.created_at DESC
        ) AS row_num
    FROM enriched_events ee
)
SELECT
    discord_user_id,
    member_id,
    member_name,
    event_name,
    created_at,
    reset_id,
    raid_name,
    raid_date,
    from_reset_id,
    from_raid_name,
    from_raid_date,
    to_reset_id,
    to_raid_name,
    to_raid_date
FROM ranked_events
WHERE row_num = 1
ORDER BY created_at ASC;
