export type WorkflowStepContextInput = Record<string, any> | void
export type WorkflowStepContextOutput = Record<string, any> | void

export type ExecutionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stopped'
export type ActivityStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped'

export type WorkflowExecution = {
    id: number
    workflowId: string
    name: string
    status: ExecutionStatus
    currentStepId: string
    lastStepId: string
    createdAt: Date
    updatedAt: Date
    error?: string
}

export type WorkflowActivity = {
    id: string
    executionId: number
    name: string
    status: ActivityStatus
    createdAt: Date
    updatedAt: Date
    error?: string
    output?: WorkflowStepContextOutput
    input?: WorkflowStepContextInput
}

export interface WorkflowRunRepositoryPort {
    createExecution(workflowId: string, name: string): Promise<WorkflowExecution>
    updateExecution(id: number, updates: {
        status?: ExecutionStatus
        currentStepId?: string
        lastStepId?: string
        error?: string
    }): Promise<void>
    createActivity(executionId: number, name: string): Promise<WorkflowActivity>
    updateActivity(id: string, updates: {
        status?: ActivityStatus
        error?: string
        output?: WorkflowStepContextOutput
        input?: WorkflowStepContextInput
    }): Promise<void>

    cleanup(daysAgo: number): Promise<void>
}
