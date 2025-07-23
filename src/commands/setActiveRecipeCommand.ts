import * as vscode from 'vscode';
import { Command } from './index';

export class SetActiveRecipeCommand extends Command {
    register(context: vscode.ExtensionContext): void {
        const disposable = vscode.commands.registerCommand(
            'moderne.setActiveRecipe',
            this.execute.bind(this)
        );
        context.subscriptions.push(disposable);
    }

    async execute(uri?: vscode.Uri): Promise<void> {
        try {
            // Get the current active editor or use provided URI
            const editor = vscode.window.activeTextEditor;
            const document = uri 
                ? await vscode.workspace.openTextDocument(uri)
                : editor?.document;

            if (!document) {
                vscode.window.showErrorMessage('No active document found');
                return;
            }

            // Check if document contains a recipe
            const recipeType = await this.services.recipe.detectRecipeType(document);
            if (!recipeType) {
                vscode.window.showErrorMessage(
                    'Current file does not contain a valid OpenRewrite recipe'
                );
                return;
            }

            // Set as active recipe
            await this.services.recipe.setActiveRecipe(document);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Set Active Recipe command failed', error);
            vscode.window.showErrorMessage(`Failed to set active recipe: ${message}`);
        }
    }
}