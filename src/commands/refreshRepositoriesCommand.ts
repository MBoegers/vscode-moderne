import * as vscode from 'vscode';
import { Command } from './baseCommand';

export class RefreshRepositoriesCommand extends Command {
    register(context: vscode.ExtensionContext): void {
        const disposable = vscode.commands.registerCommand(
            'moderne.refreshRepositories',
            this.execute.bind(this)
        );
        context.subscriptions.push(disposable);
    }

    async execute(): Promise<void> {
        try {
            // Show progress indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Refreshing repositories...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Loading repository data...' });
                
                await this.services.repository.refreshRepositories();
                
                progress.report({ increment: 100, message: 'Complete' });
            });

            const stats = this.services.repository.getBuildStatistics();
            vscode.window.showInformationMessage(
                `Refreshed ${stats.total} repositories (${stats.withLsts} with LSTs)`
            );

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Refresh repositories command failed', error);
            vscode.window.showErrorMessage(`Failed to refresh repositories: ${message}`);
        }
    }
}