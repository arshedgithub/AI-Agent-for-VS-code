export interface FileStructure {
    type: 'file';
    extension: string;
    content: string;
    path: string;
}

export interface DirectoryStructure {
    [key: string]: FileStructure | DirectoryStructure;
}

export type ProjectStructure = DirectoryStructure | null;
