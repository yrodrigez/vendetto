export type WorkflowScheduleStatus = 'running' | 'stopped' | 'error' | 'scheduled'

export type WorkflowSchedule = {
    id: string
    name: string
    context: string | null
    status: WorkflowScheduleStatus
    scheduler: string | null
    nextExecution: Date | null
    createdAt: Date
}

export interface WorkflowSchedulerRepositoryPort {
    findDueWorkflows(): Promise<WorkflowSchedule[]>
    findByNameAndContext(name: string, context: string): Promise<WorkflowSchedule | undefined>
    upsert(name: string, scheduler: string, status: WorkflowScheduleStatus, context?: string): Promise<WorkflowSchedule>
    updateNextExecution(id: string, nextExecution: Date): Promise<void>
    updateStatus(id: string, status: WorkflowScheduleStatus): Promise<void>
}
