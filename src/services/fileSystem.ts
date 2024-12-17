import path from 'path';
import { promises } from 'fs';
import { FileStructure, DirectoryStructure, ProjectStructure } from '../types';
import { SUPPORTED_EXTENSIONS, EXCLUDED_DIRECTORIES, EXCLUDED_FILE_PATTERNS } from '../config';

export class FileSystemService {
    private static instance: FileSystemService;

    private constructor() { }

    public static getInstance(): FileSystemService {
        if (!FileSystemService.instance) {
            FileSystemService.instance = new FileSystemService();
        }
        return FileSystemService.instance;
    }

    public async analyzeProjectStructure(rootPath: string): Promise<ProjectStructure> {
        return this.processDirectory(rootPath);
    }

    private async processDirectory(dirPath: string): Promise<DirectoryStructure | null> {
        try {
            const entries = await promises.readdir(dirPath, { withFileTypes: true });
            const structure: DirectoryStructure = {};

            for (const entry of entries) {
                if (EXCLUDED_DIRECTORIES.includes(entry.name)) continue;

                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    const subStructure = await this.processDirectory(fullPath);
                    if (subStructure && Object.keys(subStructure).length > 0) {
                        structure[entry.name] = subStructure;
                    }
                } else {
                    const fileStructure = await this.processFile(fullPath, entry.name);
                    if (fileStructure) {
                        structure[entry.name] = fileStructure;
                    }
                }
            }

            return structure;
        } catch (error) {
            console.error(`Error processing directory ${dirPath}:`, error);
            return null;
        }
    }

    private async processFile(fullPath: string, fileName: string): Promise<FileStructure | null> {
        if (EXCLUDED_FILE_PATTERNS.some(pattern => pattern.test(fileName))) return null;

        const ext = path.extname(fileName).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.includes(ext)) return null;

        try {
            const content = await promises.readFile(fullPath, 'utf8');
            return {
                type: 'file',
                extension: ext,
                content,
                path: fullPath
            };
        } catch (error) {
            console.error(`Error reading file ${fullPath}:`, error);
            return null;
        }
    }
}