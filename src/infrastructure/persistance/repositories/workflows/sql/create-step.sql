INSERT INTO workflow.workflow_activities (execution_id, name, status)
VALUES ($1, $2, 'queued')
RETURNING id, execution_id, name, status, created_at, updated_at, error
