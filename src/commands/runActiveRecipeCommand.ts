import * as vscode from 'vscode';
import { Command } from './baseCommand';

export class RunActiveRecipeCommand extends Command {
    register(context: vscode.ExtensionContext): void {
        const disposable = vscode.commands.registerCommand(
            'moderne.runActiveRecipe',
            this.execute.bind(this)
        );
        context.subscriptions.push(disposable);
    }

    async execute(repositoryPath?: string): Promise<void> {
        try {
            const activeRecipe = this.services.recipe.getActiveRecipe();
            
            if (!activeRecipe) {
                const response = await vscode.window.showWarningMessage(
                    'No active recipe is set. Would you like to set one?',
                    'Set Active Recipe',
                    'Cancel'
                );
                
                if (response === 'Set Active Recipe') {
                    await vscode.commands.executeCommand('moderne.setActiveRecipe');
                }
                return;
            }

            // Get the target repository path
            const targetPath = await this.getTargetPath(repositoryPath);
            if (!targetPath) {
                return;
            }

            // Run the recipe with progress reporting
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Running recipe: ${activeRecipe.displayName}`,
                cancellable: true
            }, async (progress, token) => {
                if (token.isCancellationRequested) {
                    throw new Error('Operation cancelled by user');
                }

                progress.report({ increment: 0, message: 'Preparing to run recipe...' });

                // Build the CLI command
                const args = ['run', targetPath, '--active-recipe'];
                
                // Add any required options
                if (activeRecipe.requiredOptions && activeRecipe.requiredOptions.length > 0) {
                    const options = await this.collectRequiredOptions(activeRecipe.requiredOptions);
                    if (!options) {
                        throw new Error('Required options not provided');
                    }
                    args.push(...options);
                }

                progress.report({ increment: 25, message: 'Executing recipe...' });

                const result = await this.services.cli.executeCommand(args, {
                    cwd: targetPath,
                    timeout: 300000 // 5 minutes
                });

                progress.report({ increment: 100, message: 'Recipe completed' });

                if (result.success) {
                    this.services.logger.info(`Recipe "${activeRecipe.displayName}" completed successfully`);
                } else {
                    throw new Error(result.error || 'Recipe execution failed');
                }
            });

            // Show success message
            const response = await vscode.window.showInformationMessage(
                `Recipe "${activeRecipe.displayName}" completed successfully!`,
                'View Output',
                'Open Files'
            );

            if (response === 'View Output') {
                this.services.logger.show();
            } else if (response === 'Open Files') {
                // Refresh file explorer to show changes
                await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Run Active Recipe command failed', error);
            
            if (message === 'Operation cancelled by user') {
                vscode.window.showInformationMessage('Recipe execution cancelled');
            } else {
                vscode.window.showErrorMessage(
                    `Failed to run recipe: ${message}`,
                    'View Output'
                ).then(selection => {
                    if (selection === 'View Output') {
                        this.services.logger.show();
                    }
                });
            }
        }
    }

    private async getTargetPath(providedPath?: string): Promise<string | undefined> {
        if (providedPath) {
            return providedPath;
        }

        // Use current workspace folder
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length === 1) {
            return workspaceFolders[0].uri.fsPath;
        }

        // Multiple workspace folders - let user choose
        if (workspaceFolders && workspaceFolders.length > 1) {
            const items = workspaceFolders.map(folder => ({
                label: folder.name,
                detail: folder.uri.fsPath,
                picked: false
            }));

            const selection = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select the repository to run the recipe on',
                canPickMany: false
            });

            return selection?.detail;
        }

        // No workspace folders - let user pick a folder
        const folderUris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Repository Folder'
        });

        return folderUris?.[0]?.fsPath;
    }

    private async collectRequiredOptions(requiredOptions: any[]): Promise<string[] | undefined> {
        const options: string[] = [];

        for (const option of requiredOptions) {
            if (option.required) {
                const value = await vscode.window.showInputBox({
                    prompt: `Enter value for ${option.name}`,
                    placeHolder: option.description || `Value for ${option.name}`,
                    validateInput: (input) => {
                        if (!input.trim()) {
                            return 'Value is required';
                        }
                        return null;
                    }
                });

                if (!value) {
                    return undefined; // User cancelled
                }

                options.push(`--${option.name}=${value}`);
            }
        }

        return options;
    }
}