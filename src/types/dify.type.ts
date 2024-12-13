import { ProjectStructure } from "./structure.type";

export interface DIFYResponse {
    answer: string;
    needsClarification?: boolean;
    clarificationQuestion?: string;
}

export interface DIFYContext {
    projectStructure: ProjectStructure;
    currentFile?: string;
    previousQuestion?: string;
    previousResponse?: string;
}