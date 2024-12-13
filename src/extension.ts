import * as vscode from 'vscode';
import { DifyApiService, registerCommands, StatusBarManager } from './';

export async function activate(context: vscode.ExtensionContext) {
    await DifyApiService.initialize(context);
    console.log("DIFY AI assistant is activated");
    registerCommands(context);
    const statusBarManager = StatusBarManager.getInstance();
    context.subscriptions.push(statusBarManager.getStatusBarItem());
}

export function deactivate() {}