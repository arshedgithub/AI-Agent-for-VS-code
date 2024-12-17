export interface DIFYResponse {
    event: string;
    message_id: string;
    conversation_id: string;
    mode: string;
    answer: string;
    metadata: Object;
    created_at: number;
}

export interface DIFYContext {
    conversation_id?: string;
    currentFile?: string;
    projectSummary?: string;
}