import * as vscode from 'vscode';
import { Command } from './index';
import { RecipeType } from '../models/recipe';

export class CreateRecipeCommand extends Command {
    register(context: vscode.ExtensionContext): void {
        const disposable = vscode.commands.registerCommand(
            'moderne.createRecipe',
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
                vscode.window.showErrorMessage('Please select code to create a recipe from');
                return;
            }

            // Show recipe type selection
            const recipeTypes = [
                {
                    label: 'Refaster Recipe',
                    description: 'Pattern-based before/after transformations',
                    type: RecipeType.Refaster
                },
                {
                    label: 'Visitor Recipe',
                    description: 'Imperative visitor-based transformations',
                    type: RecipeType.Visitor
                },
                {
                    label: 'YAML Recipe',
                    description: 'Declarative YAML-based recipe',
                    type: RecipeType.Yaml
                }
            ];

            const selected = await vscode.window.showQuickPick(recipeTypes, {
                placeHolder: 'Select recipe type to generate'
            });

            if (!selected) {
                return;
            }

            // This is a placeholder for Phase 1
            // Full implementation will be in Phase 4
            vscode.window.showInformationMessage(
                `Create ${selected.label} - Feature will be implemented in Phase 4`,
                'OK'
            );

            this.services.logger.info(`Recipe creation requested: ${selected.type}`);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Create Recipe command failed', error);
            vscode.window.showErrorMessage(`Create recipe failed: ${message}`);
        }
    }
}