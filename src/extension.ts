import * as vscode from 'vscode';
import { registerCommands, StatusBarManager } from './';

export function activate(context: vscode.ExtensionContext) {
    console.log("DIFY assistat is activated");
    registerCommands(context);
    const statusBarManager = StatusBarManager.getInstance();
    context.subscriptions.push(statusBarManager.getStatusBarItem());
}

export function deactivate() {}