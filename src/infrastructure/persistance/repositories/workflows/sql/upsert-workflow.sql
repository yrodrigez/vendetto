INSERT INTO workflow.workflows (name, scheduler, status, context)
VALUES ($1, $2, $3, COALESCE($4, ''))
ON CONFLICT (name, COALESCE(context, '')) DO UPDATE
    SET scheduler = EXCLUDED.scheduler,
        status    = EXCLUDED.status
RETURNING id, name, context, status, scheduler, next_execution, created_at
