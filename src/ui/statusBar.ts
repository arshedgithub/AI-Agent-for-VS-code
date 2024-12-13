import * as vscode from 'vscode';

export class StatusBarManager {
    private static instance: StatusBarManager;
    private statusBarItem: vscode.StatusBarItem;

    private constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right
        );
        this.statusBarItem.text = "$(symbol-structure) DIFY Assistant";
        this.statusBarItem.command = 'difyassistant.askQuestion';
        this.statusBarItem.show();
    }

    public static getInstance(): StatusBarManager {
        if (!StatusBarManager.instance) {
            StatusBarManager.instance = new StatusBarManager();
        }
        return StatusBarManager.instance;
    }

    public getStatusBarItem(): vscode.StatusBarItem {
        return this.statusBarItem;
    }
}