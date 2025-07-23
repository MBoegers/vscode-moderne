import * as vscode from 'vscode';
import { ServiceRegistry } from '../extension';
import { SetActiveRecipeCommand } from './setActiveRecipeCommand';
import { FindUsagesCommand } from './findUsagesCommand';
import { CreateRecipeCommand } from './createRecipeCommand';
import { RefreshRepositoriesCommand } from './refreshRepositoriesCommand';
import { CheckCliStatusCommand } from './checkCliStatusCommand';
import { TestCommand } from './testCommand';

export function registerCommands(
    context: vscode.ExtensionContext,
    services: ServiceRegistry
): void {
    const commands = [
        new TestCommand(services), // Add test command first for debugging
        new SetActiveRecipeCommand(services),
        new FindUsagesCommand(services),
        new CreateRecipeCommand(services),
        new RefreshRepositoriesCommand(services),
        new CheckCliStatusCommand(services)
    ];

    commands.forEach(command => {
        command.register(context);
    });

    services.logger.info(`Registered ${commands.length} commands`);
}