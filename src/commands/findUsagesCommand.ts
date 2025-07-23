import * as vscode from 'vscode';
import { Command } from './baseCommand';

export class FindUsagesCommand extends Command {
    register(context: vscode.ExtensionContext): void {
        const disposable = vscode.commands.registerCommand(
            'moderne.findUsagesAllRepos',
            this.execute.bind(this)
        );
        context.subscriptions.push(disposable);
    }

    async execute(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showErrorMessage('Please select code to search for');
                return;
            }

            const selectedText = editor.document.getText(selection);
            
            // Show quick pick for search strategy
            const options = [
                {
                    label: 'Run Find Recipe',
                    description: 'Search using existing OpenRewrite find recipes',
                    action: 'run'
                },
                {
                    label: 'Create Search Recipe (Refaster)',
                    description: 'Generate Refaster template for selected pattern',
                    action: 'create-refaster'
                },
                {
                    label: 'Create Search Recipe (Visitor)',
                    description: 'Generate visitor-based search recipe',
                    action: 'create-visitor'
                }
            ];

            const selected = await vscode.window.showQuickPick(options, {
                placeHolder: 'Choose search strategy'
            });

            if (!selected) {
                return;
            }

            switch (selected.action) {
                case 'run':
                    await this.runFindRecipe(selectedText);
                    break;
                case 'create-refaster':
                case 'create-visitor':
                    vscode.window.showInformationMessage(
                        `${selected.label} will be implemented in Phase 4`
                    );
                    break;
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Find Usages command failed', error);
            vscode.window.showErrorMessage(`Find usages failed: ${message}`);
        }
    }

    private async runFindRecipe(selectedText: string): Promise<void> {
        // This is a placeholder implementation for Phase 1
        // In Phase 3, this will be fully implemented with CLI integration
        
        vscode.window.showInformationMessage(
            `Find usages for "${selectedText}" - Feature will be implemented in Phase 3`,
            'OK'
        );
        
        this.services.logger.info(`Find usages requested for: ${selectedText}`);
    }
}