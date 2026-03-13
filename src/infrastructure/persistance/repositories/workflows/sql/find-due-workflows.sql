SELECT id, name, context, status, scheduler, next_execution, created_at
FROM workflow.workflows
WHERE status = 'running'
  AND next_execution <= NOW()
