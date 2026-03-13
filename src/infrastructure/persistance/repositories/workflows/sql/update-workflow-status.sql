UPDATE workflow.workflows
SET status = $2
WHERE id = $1
