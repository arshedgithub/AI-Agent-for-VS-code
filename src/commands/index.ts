import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ProjectStructure, DIFYContext } from '../types';
import { DifyApiService, FileSystemService, ProjectContextService } from '../services';

let projectStructure: ProjectStructure = null;

export function registerCommands(context: vscode.ExtensionContext) {
    const fileSystemService = FileSystemService.getInstance();
    const difyApiService = DifyApiService.getInstance();

    const analyzeCommand = vscode.commands.registerCommand(
        'difyassistant.analyzeProject',
        createAnalyzeProjectCommand(fileSystemService)
    );

    const askCommand = vscode.commands.registerCommand(
        'difyassistant.askQuestion',
        createAskQuestionCommand(difyApiService)
    );

    context.subscriptions.push(analyzeCommand, askCommand);
}

function createAnalyzeProjectCommand(fileSystemService: FileSystemService) {
    return async () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Analyzing project structure...",
            cancellable: false
        }, async () => {
            projectStructure = await fileSystemService.analyzeProjectStructure(workspaceRoot);
            console.log(projectStructure);
            vscode.window.showInformationMessage('Project structure analysis complete');
        });
    };
}

async function generateFiles(files: { path: string, content: string }[]): Promise<string[]> {
    const processedFiles: string[] = [];

    for (const file of files) {
        const fullPath = path.resolve(vscode.workspace.workspaceFolders![0].uri.fsPath, file.path);

        try {
            // Ensure the directory exists
            await fs.ensureDir(path.dirname(fullPath));

            // Check if file exists
            const fileExists = await fs.pathExists(fullPath);

            if (fileExists) {
                // Read existing content
                const existingContent = await fs.readFile(fullPath, 'utf8');

                // If content is different, update the file
                if (existingContent.trim() !== file.content.trim()) {
                    await fs.writeFile(fullPath, file.content);
                    processedFiles.push(`Updated: ${file.path}`);
                }
            } else {
                await fs.writeFile(fullPath, file.content);
                processedFiles.push(`Created: ${file.path}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error processing file ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return processedFiles;
}

async function handleDifyResponse(
    difyApiService: DifyApiService,
    question: string,
    context: DIFYContext,
    outputChannel: vscode.OutputChannel
) {
    let currentContext = { ...context };

    try {
        // Send initial query
        const response = await difyApiService.query(question, currentContext);
        outputChannel.appendLine(response.answer);

        // Check if response contains file generation instructions
        const fileGenerationMatch = response.answer.match(/```json\s*files\s*\n([\s\S]*?)```/i);
        if (fileGenerationMatch) {
            try {
                const filesToGenerate = JSON.parse(fileGenerationMatch[1]);
                console.log(`Parsed file generation instructions: ${JSON.stringify(filesToGenerate, null, 2)}`);

                if (Array.isArray(filesToGenerate)) {
                    const processedFiles = await generateFiles(filesToGenerate);

                    if (processedFiles.length > 0) {
                        outputChannel.appendLine('\nFiles Generated/Updated:');
                        processedFiles.forEach(file => outputChannel.appendLine(file));

                        vscode.window.showInformationMessage(`Generated/Updated ${processedFiles.length} file(s)`);
                    } else {
                        outputChannel.appendLine('No files were generated or updated.');
                    }
                }
            } catch (parseError) {
                outputChannel.appendLine('Error parsing file generation instructions');
                vscode.window.showWarningMessage('Could not parse file generation instructions');
            }
        }

        // Store conversation ID for future queries
        if (response.conversation_id) {
            currentContext = {
                ...currentContext,
                conversation_id: response.conversation_id
            };
        }

        outputChannel.show();
        return {
            response,
            context: currentContext
        };
    } catch (error) {
        outputChannel.appendLine('\nError:');
        outputChannel.appendLine(error instanceof Error ? error.message : 'An unknown error occurred');
        outputChannel.show();
        throw error;
    }
}

function createAskQuestionCommand(difyApiService: DifyApiService) {
    let conversationContext: DIFYContext = {};
    const contextService = ProjectContextService.getInstance();

    return async () => {
        if (!projectStructure) {
            vscode.window.showErrorMessage('Please analyze the project structure first');
            return;
        }

        const question = await vscode.window.showInputBox({
            prompt: 'What would you like to know about the codebase?',
            placeHolder: 'e.g., How is the authentication implemented?'
        });

        if (!question) return;

        try {
            // Generate concise project context
            const projectSummary = contextService.generateProjectSummary(projectStructure);

            // Get current file context if available
            let fileContext = '';
            if (vscode.window.activeTextEditor) {
                const currentFile = vscode.window.activeTextEditor.document;
                fileContext = contextService.generateFileContext(
                    currentFile.fileName,
                    currentFile.getText()
                );
            }

            // Combine question with context
            const enhancedQuery = `
Context:
${projectSummary}
${fileContext}

Question: ${question}

Note: If you suggest generating or updating files, please wrap the file generation JSON in a files block. 
The JSON should be an array of objects with 'path' and 'content' properties`;

            const initialContext: DIFYContext = {
                ...conversationContext,
                currentFile: vscode.window.activeTextEditor?.document.fileName
            };

            const outputChannel = vscode.window.createOutputChannel('DIFY Assistant');
            const result = await handleDifyResponse(
                difyApiService,
                enhancedQuery,
                initialContext,
                outputChannel
            );

            conversationContext = result.context;

        } catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
            } else {
                vscode.window.showErrorMessage('An unknown error occurred');
            }
        }
    };
}