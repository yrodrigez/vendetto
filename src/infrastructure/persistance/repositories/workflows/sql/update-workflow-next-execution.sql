UPDATE workflow.workflows
SET next_execution = $2
WHERE id = $1
