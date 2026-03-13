UPDATE workflow.workflow_executions
SET status          = COALESCE($2, status),
    current_step_id = COALESCE($3, current_step_id),
    last_step_id    = COALESCE($4, last_step_id),
    error           = COALESCE($5, error),
    updated_at      = NOW()
WHERE id = $1
