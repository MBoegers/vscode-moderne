import * as vscode from 'vscode';
import { ServiceRegistry } from '../extension';

export abstract class Command {
    protected services: ServiceRegistry;

    constructor(services: ServiceRegistry) {
        this.services = services;
    }

    abstract register(context: vscode.ExtensionContext): void;
    abstract execute(...args: any[]): Promise<void>;
}