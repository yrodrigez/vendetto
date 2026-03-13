select 
m.id as member_id, 
m.character->>'name' as character_name,
op.provider_user_id as discord_user_id
    from public.ev_member m
    inner join ev_auth.oauth_providers op on op.user_id = m.user_id
    where op.provider like '%discord%'
      and m.is_selected = true;