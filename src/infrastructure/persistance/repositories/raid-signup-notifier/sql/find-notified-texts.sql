SELECT 
    b."text" AS notification_text
FROM 
    open_campaign.broadlog b
WHERE 
    b.communication_code = $1
    AND b.created_at >= NOW() - ($2 || ' seconds')::interval
    AND b.last_event = 'success';
