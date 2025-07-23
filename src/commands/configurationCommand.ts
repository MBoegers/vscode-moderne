import * as vscode from 'vscode';
import { Command } from './baseCommand';

export class ConfigurationCommand extends Command {
    register(context: vscode.ExtensionContext): void {
        const disposable = vscode.commands.registerCommand(
            'moderne.openConfiguration',
            this.execute.bind(this)
        );
        context.subscriptions.push(disposable);
    }

    async execute(): Promise<void> {
        try {
            const health = this.services.config.getConfigurationHealth();
            
            // Show configuration health status
            await this.showConfigurationStatus(health);
            
            // Open VSCode settings
            await vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'moderne'
            );
            
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Configuration command failed', error);
            vscode.window.showErrorMessage(`Failed to open configuration: ${message}`);
        }
    }

    private async showConfigurationStatus(health: { status: 'healthy' | 'warning' | 'error'; issues: string[] }): Promise<void> {
        if (health.status === 'healthy') {
            vscode.window.showInformationMessage('Moderne configuration is healthy ✅');
            return;
        }

        const issueList = health.issues.map(issue => `• ${issue}`).join('\n');
        const severity = health.status === 'error' ? 'errors' : 'warnings';
        
        const message = `Moderne configuration has ${severity}:\n\n${issueList}`;
        
        const actions = ['Open Settings', 'View Documentation'];
        const result = health.status === 'error' 
            ? await vscode.window.showErrorMessage(message, ...actions)
            : await vscode.window.showWarningMessage(message, ...actions);

        if (result === 'View Documentation') {
            vscode.env.openExternal(vscode.Uri.parse('https://docs.moderne.io/cli/installation'));
        }
    }
}