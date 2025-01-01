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

    const testCommand = vscode.commands.registerCommand(
        'difyassistant.testFileGeneration',
        testFileGeneration
    );

    context.subscriptions.push(analyzeCommand, askCommand, testCommand);
}

function testFileGeneration() {
    console.log("test file called");
    
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Testing file generation...",
        cancellable: false
    }, async () => {
        try {
            const testFiles = [{
                path: 'test/test-file.txt',
                content: 'This is a test file content'
            }];

            console.log('Testing file generation with:', testFiles);
            const results = await generateFiles(testFiles);
            console.log('Generation results:', results);

            vscode.window.showInformationMessage('Test file generation complete');
            return results;
        } catch (error) {
            console.error('Test failed:', error);
            vscode.window.showErrorMessage('Test file generation failed: ' + (error instanceof Error ? error.message : String(error)));
            throw error;
        }
    });
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
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder is open.');
        return [];
    }

    const processedFiles: string[] = [];

    for (const file of files) {
        const fullPath = path.resolve(workspaceRoot, file.path);

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
                } else {
                    processedFiles.push(`Skipped (no changes): ${file.path}`);
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
        const response = await difyApiService.query(question, currentContext);
        outputChannel.appendLine('Question: ' + question);
        outputChannel.appendLine('\nResponse:');
        outputChannel.appendLine(response.answer);

        // More flexible pattern matching for JSON blocks
        const jsonBlocks = response.answer.match(/```(?:json files?|json)\s*([\s\S]*?)```/gmi);
        console.log('Found JSON blocks:', jsonBlocks);

        if (jsonBlocks) {
            for (const block of jsonBlocks) {
                try {
                    // Clean the JSON content - remove the ```json or ```json files wrapper
                    const jsonContent = block.replace(/```(?:json files?|json)\s*|```/gi, '').trim();
                    console.log('Cleaned JSON content:', jsonContent);

                    const filesToGenerate = JSON.parse(jsonContent);
                    console.log('Parsed files:', filesToGenerate);

                    if (Array.isArray(filesToGenerate) && filesToGenerate.length > 0) {
                        outputChannel.appendLine('\nGenerating files...');
                        
                        // Log each file to be generated
                        filesToGenerate.forEach(file => {
                            console.log('Processing file:', file.path);
                        });

                        const processedFiles = await generateFiles(filesToGenerate);
                        
                        outputChannel.appendLine('\nFiles Generated:');
                        processedFiles.forEach(file => {
                            outputChannel.appendLine(file);
                            console.log('Generated:', file);
                        });

                        vscode.window.showInformationMessage(
                            `Successfully generated ${processedFiles.length} file(s)`
                        );
                    }
                } catch (parseError: any) {
                    console.error('Error parsing JSON:', parseError);
                    outputChannel.appendLine(`\nError parsing file instructions: ${parseError.message}`);
                }
            }
        } else {
            console.log('No JSON blocks found in response');
            outputChannel.appendLine('\nNo file generation instructions found');
        }

        outputChannel.show();
        return { response, context: currentContext };
    } catch (error) {
        console.error('Response handler error:', error);
        outputChannel.appendLine('\nError: ' + (error instanceof Error ? error.message : String(error)));
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

Note: If you need to generate or update files, please provide the file generation instructions in the following JSON format wrapped in a code block:

\`\`\`json files
[
    {
        "path": "relative/path/to/file.ts",
        "content": "file content here"
    }
]
\`\`\`
`;

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