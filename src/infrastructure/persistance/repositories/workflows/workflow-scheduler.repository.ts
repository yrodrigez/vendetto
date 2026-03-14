import { DatabaseClient } from "@/infrastructure/database/db";
import { readResourceFile } from "@/util/file-resource-helper";
import {
    type WorkflowSchedulerRepositoryPort,
    type WorkflowSchedule,
    type WorkflowScheduleStatus
} from "@/application/ports/outbound/workflow-scheduler-repository.port";

type WorkflowScheduleRow = {
    id: string
    name: string
    context: string | null
    status: string
    scheduler: string | null
    next_execution: Date | null
    created_at: Date
}

function mapScheduledWorkflow(row: WorkflowScheduleRow): WorkflowSchedule {
    return {
        id: row.id,
        name: row.name,
        context: row.context,
        status: row.status as WorkflowScheduleStatus,
        scheduler: row.scheduler,
        nextExecution: row.next_execution,
        createdAt: row.created_at
    }
}

export class WorkflowSchedulerRepository implements WorkflowSchedulerRepositoryPort {
    constructor(private readonly db: DatabaseClient) { }

    async findDueWorkflows(): Promise<WorkflowSchedule[]> {
        const sql = readResourceFile(__dirname, 'sql/find-due-workflows.sql')
        const rows = await this.db.query<WorkflowScheduleRow>(sql)
        return rows.map(mapScheduledWorkflow)
    }

    async findByNameAndContext(name: string, context: string): Promise<WorkflowSchedule | undefined> {
        const sql = readResourceFile(__dirname, 'sql/find-workflow-by-name.sql')
        const rows = await this.db.query<WorkflowScheduleRow>(sql, [name, context])
        return rows[0] ? mapScheduledWorkflow(rows[0]) : undefined
    }

    async upsert(name: string, scheduler: string, status: WorkflowScheduleStatus, context: string): Promise<WorkflowSchedule> {
        const sql = readResourceFile(__dirname, 'sql/upsert-workflow.sql')
        const rows = await this.db.query<WorkflowScheduleRow>(sql, [name, scheduler, status, context])
        return mapScheduledWorkflow(rows[0])
    }

    async updateNextExecution(id: string, nextExecution: Date): Promise<void> {
        const sql = readResourceFile(__dirname, 'sql/update-workflow-next-execution.sql')
        await this.db.query(sql, [id, nextExecution])
    }

    async updateStatus(id: string, status: WorkflowScheduleStatus): Promise<void> {
        const sql = readResourceFile(__dirname, 'sql/update-workflow-status.sql')
        await this.db.query(sql, [id, status])
    }
}
