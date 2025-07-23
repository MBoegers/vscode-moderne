import * as vscode from 'vscode';
import { Command } from './baseCommand';

export class TestCommand extends Command {
    register(context: vscode.ExtensionContext): void {
        const disposable = vscode.commands.registerCommand(
            'moderne.test',
            this.execute.bind(this)
        );
        context.subscriptions.push(disposable);
        this.services.logger.info('Test command registered successfully');
    }

    async execute(): Promise<void> {
        vscode.window.showInformationMessage('Moderne extension is working! Commands are registered correctly.');
        this.services.logger.info('Test command executed successfully');
    }
}