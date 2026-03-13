SELECT id, name, context, status, scheduler, next_execution, created_at
FROM workflow.workflows
WHERE name = $1
  AND COALESCE(context, '') = COALESCE($2, '')
LIMIT 1
