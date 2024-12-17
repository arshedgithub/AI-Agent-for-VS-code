    import { SUPPORTED_EXTENSIONS } from '../config';
    import { DirectoryStructure, FileStructure } from '../types';

    export class ProjectContextService {
        private static instance: ProjectContextService;
        // private maxSummaryLength = 3000;

        private constructor() {}

        public static getInstance(): ProjectContextService {
            if (!ProjectContextService.instance) {
                ProjectContextService.instance = new ProjectContextService();
            }
            return ProjectContextService.instance;
        }

        public generateProjectSummary(structure: DirectoryStructure): string {
            const summary = this.summarizeStructure(structure);
            return `Project Structure Summary:\n${summary}`;
        }

        private summarizeStructure(structure: DirectoryStructure, depth: number = 0): string {
            let summary = '';
            const indent = '  '.repeat(depth);

            for (const [name, item] of Object.entries(structure)) {
                if (this.shouldIncludeInSummary(name, item)) {
                    if (this.isFile(item)) {
                        // For files, include name and brief content summary
                        const fileType = this.getFileType(name);
                        summary += `${indent}- ${name} (${fileType})\n`;
                    } else {
                        // For directories, recursively summarize content
                        summary += `${indent}+ ${name}/\n`;
                        summary += this.summarizeStructure(item as DirectoryStructure, depth + 1);
                    }
                }
            }
            return summary;
        }

        private isFile(item: FileStructure | DirectoryStructure): item is FileStructure {
            return (item as FileStructure).type === 'file';
        }

        private getFileType(fileName: string): string {
            const ext = fileName.split('.').pop()?.toLowerCase() || '';
            return ext;
        }

        private shouldIncludeInSummary(name: string, item: FileStructure | DirectoryStructure): boolean {
            if (name.startsWith('.') || name === 'node_modules' || name === 'dist') {
                return false;
            }

            if (this.isFile(item)) {
                return SUPPORTED_EXTENSIONS.some(ext => name.endsWith(ext));
            }

            return true;
        }

        public generateFileContext(filePath: string, content: string): string {
            // Generate context for the current file being discussed
            return `Current File (${filePath}):\n${this.summarizeFileContent(content)}`;
        }

        private summarizeFileContent(content: string): string {
            // Extract important parts of the file (e.g., class/function names)
            const lines = content.split('\n');
            const summary = lines
                .filter(line => this.isImportantLine(line))
                .slice(0, 15) // Limit to first 15 important lines
                .join('\n');
            return summary;
        }

        private isImportantLine(line: string): boolean {
            return line.includes('class ') ||
                line.includes('function ') ||
                line.includes('interface ') ||
                line.includes('export ') ||
                line.includes('import ');
        }
    }