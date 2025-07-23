import * as vscode from 'vscode';
import { ServiceRegistry } from '../extension';
import { SetActiveRecipeCommand } from './setActiveRecipeCommand';
import { FindUsagesCommand } from './findUsagesCommand';
import { CreateRecipeCommand } from './createRecipeCommand';
import { RefreshRepositoriesCommand } from './refreshRepositoriesCommand';
import { CheckCliStatusCommand } from './checkCliStatusCommand';

export function registerCommands(
    context: vscode.ExtensionContext,
    services: ServiceRegistry
): void {
    const commands = [
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

export abstract class Command {
    protected services: ServiceRegistry;

    constructor(services: ServiceRegistry) {
        this.services = services;
    }

    abstract register(context: vscode.ExtensionContext): void;
    abstract execute(...args: any[]): Promise<void>;
}