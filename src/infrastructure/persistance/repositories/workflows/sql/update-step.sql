UPDATE workflow.workflow_activities
SET status     = COALESCE($2, status),
    error      = COALESCE($3, error),
    output     = COALESCE($4::jsonb, output),
    updated_at = NOW()
WHERE id = $1
