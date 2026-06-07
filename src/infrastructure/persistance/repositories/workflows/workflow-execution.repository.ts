import {
    type ActivityStatus,
    type ExecutionStatus,
    type WorkflowActivity,
    type WorkflowExecution,
    type WorkflowRunRepositoryPort,
    WorkflowStepContextOutput
} from "@/application/ports/outbound/database/workflow-run-repository.port";
import { DatabaseClient } from "@/infrastructure/database/db";
import { readResourceFile } from "@/util/file-resource-helper";

type ExecutionRow = {
    id: number
    workflow_id: string
    name: string
    status: string
    current_step_id: string
    last_step_id: string
    created_at: Date
    updated_at: Date
    error: string | null
}

type ActivityRow = {
    id: string
    execution_id: number
    name: string
    status: string
    created_at: Date
    updated_at: Date
    error: string | null
}

function mapExecution(row: ExecutionRow): WorkflowExecution {
    return {
        id: row.id,
        workflowId: row.workflow_id,
        name: row.name,
        status: row.status as ExecutionStatus,
        currentStepId: row.current_step_id,
        lastStepId: row.last_step_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        error: row.error ?? undefined
    }
}

function mapActivity(row: ActivityRow): WorkflowActivity {
    return {
        id: row.id,
        executionId: row.execution_id,
        name: row.name,
        status: row.status as ActivityStatus,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        error: row.error ?? undefined
    }
}

export class WorkflowExecutionRepository implements WorkflowRunRepositoryPort {
    constructor(private readonly db: DatabaseClient) { }
    async cleanup(daysAgo: number): Promise<void> {
        const query = `
        WITH old_executions AS (
            SELECT id
            FROM workflow.workflow_executions
            WHERE created_at < now() - ($1::int * interval '1 day')
                AND status = 'completed'
        ),
        deleted_activities AS (
            DELETE FROM workflow.workflow_activities
            WHERE execution_id IN (SELECT id FROM old_executions)
            RETURNING id
        )
        DELETE FROM workflow.workflow_executions
        WHERE id IN (SELECT id FROM old_executions);
        `
        await this.db.query(query, [daysAgo])
    }



    async createExecution(workflowId: string, name: string): Promise<WorkflowExecution> {
        const sql = readResourceFile(__dirname, 'sql/create-workflow-run.sql')
        const rows = await this.db.query<ExecutionRow>(sql, [workflowId, name])
        return mapExecution(rows[0])
    }

    async updateExecution(id: number, updates: {
        status?: ExecutionStatus
        currentStepId?: string
        lastStepId?: string
        error?: string
    }): Promise<void> {
        const sql = readResourceFile(__dirname, 'sql/update-workflow-run.sql')
        await this.db.query(sql, [
            id,
            updates.status ?? null,
            updates.currentStepId ?? null,
            updates.lastStepId ?? null,
            updates.error ?? null
        ])
    }

    async createActivity(executionId: number, name: string): Promise<WorkflowActivity> {
        const sql = readResourceFile(__dirname, 'sql/create-step.sql')
        const rows = await this.db.query<ActivityRow>(sql, [executionId, name])
        return mapActivity(rows[0])
    }

    async updateActivity(id: string, updates: {
        status?: ActivityStatus
        error?: string
        output?: WorkflowStepContextOutput
    }): Promise<void> {
        const sql = readResourceFile(__dirname, 'sql/update-step.sql')
        const output =
            updates.output === undefined
                ? null
                : JSON.stringify(updates.output)

        await this.db.query(sql, [
            id,
            updates.status ?? null,
            updates.error ?? null,
            output,
        ])
    }
}
