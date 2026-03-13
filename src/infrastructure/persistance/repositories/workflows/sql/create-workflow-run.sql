INSERT INTO workflow.workflow_executions (workflow_id, name, status, last_step_id, current_step_id)
VALUES ($1, $2, 'queued', NULL, NULL)
RETURNING id, workflow_id, name, status, current_step_id, last_step_id, created_at, updated_at, error
