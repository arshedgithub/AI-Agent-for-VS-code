import * as vscode from 'vscode';
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

async function handleDifyResponse(
    difyApiService: DifyApiService,
    question: string,
    context: DIFYContext,
    outputChannel: vscode.OutputChannel
) {
    // Track conversation context
    console.log("DIFY response : command file");
    let currentContext = { ...context };

    try {
        // Send initial query
        const response = await difyApiService.query(question, currentContext);

        // Display response in output channel
        outputChannel.appendLine('Question: ' + question);
        outputChannel.appendLine('\nResponse:');
        outputChannel.appendLine(response.answer);

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

Question: ${question}`;

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