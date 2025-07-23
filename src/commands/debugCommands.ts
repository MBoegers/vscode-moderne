import * as vscode from 'vscode';
import * as path from 'path';
import { Command } from './baseCommand';
import { DebugService, DebugConfiguration, DebugSession, DebugBreakpoint } from '../services/debugService';

export class DebugCommands extends Command {
    register(context: vscode.ExtensionContext): void {
        // Start debug session command
        const startDebugDisposable = vscode.commands.registerCommand(
            'moderne.startDebugSession',
            this.startDebugSession.bind(this)
        );
        context.subscriptions.push(startDebugDisposable);

        // Stop debug session command
        const stopDebugDisposable = vscode.commands.registerCommand(
            'moderne.stopDebugSession',
            this.stopDebugSession.bind(this)
        );
        context.subscriptions.push(stopDebugDisposable);

        // Toggle breakpoint command
        const toggleBreakpointDisposable = vscode.commands.registerCommand(
            'moderne.toggleBreakpoint',
            this.toggleBreakpoint.bind(this)
        );
        context.subscriptions.push(toggleBreakpointDisposable);

        // Continue execution command
        const continueDisposable = vscode.commands.registerCommand(
            'moderne.debugContinue',
            this.continueExecution.bind(this)
        );
        context.subscriptions.push(continueDisposable);

        // Step over command
        const stepOverDisposable = vscode.commands.registerCommand(
            'moderne.debugStepOver',
            this.stepOver.bind(this)
        );
        context.subscriptions.push(stepOverDisposable);

        // Step into command
        const stepIntoDisposable = vscode.commands.registerCommand(
            'moderne.debugStepInto',
            this.stepInto.bind(this)
        );
        context.subscriptions.push(stepIntoDisposable);

        // Step out command
        const stepOutDisposable = vscode.commands.registerCommand(
            'moderne.debugStepOut',
            this.stepOut.bind(this)
        );
        context.subscriptions.push(stepOutDisposable);

        // Evaluate expression command
        const evaluateDisposable = vscode.commands.registerCommand(
            'moderne.debugEvaluate',
            this.evaluateExpression.bind(this)
        );
        context.subscriptions.push(evaluateDisposable);

        // Set conditional breakpoint command
        const conditionalBreakpointDisposable = vscode.commands.registerCommand(
            'moderne.setConditionalBreakpoint',
            this.setConditionalBreakpoint.bind(this)
        );
        context.subscriptions.push(conditionalBreakpointDisposable);

        // Remove all breakpoints command
        const removeAllBreakpointsDisposable = vscode.commands.registerCommand(
            'moderne.removeAllBreakpoints',
            this.removeAllBreakpoints.bind(this)
        );
        context.subscriptions.push(removeAllBreakpointsDisposable);
    }

    async execute(): Promise<void> {
        // This command doesn't have a direct execute - it registers sub-commands
    }

    /**
     * Start a debug session for the current recipe
     */
    private async startDebugSession(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found. Please open a recipe file.');
                return;
            }

            const recipePath = editor.document.fileName;
            
            // Validate that this is a recipe file
            if (!this.isRecipeFile(recipePath)) {
                vscode.window.showErrorMessage('Current file does not appear to be an OpenRewrite recipe.');
                return;
            }

            // Get target path for debugging
            const targetPath = await this.selectTargetPath();
            if (!targetPath) {
                return;
            }

            // Get existing breakpoints for this file
            const debugService = this.services.debug as DebugService;
            const breakpoints = debugService.getBreakpoints(recipePath);

            // Create debug configuration
            const config: DebugConfiguration = {
                recipePath,
                targetPath,
                breakpoints,
                enableLiveEdit: true,
                showInternalMethods: false,
                logLevel: 'debug'
            };

            // Start debug session
            const session = await debugService.startDebugSession(config);
            
            vscode.window.showInformationMessage(
                `Debug session started for ${path.basename(recipePath)}`,
                'Show Debug View'
            ).then(selection => {
                if (selection === 'Show Debug View') {
                    vscode.commands.executeCommand('workbench.view.extension.moderne-debug');
                }
            });

            this.services.logger.info(`Debug session started: ${session.id}`);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Start debug session failed', error);
            vscode.window.showErrorMessage(`Failed to start debug session: ${message}`);
        }
    }

    /**
     * Stop the active debug session
     */
    private async stopDebugSession(sessionId?: string): Promise<void> {
        try {
            const debugService = this.services.debug as DebugService;
            const activeSessions = debugService.getActiveSessions();

            if (activeSessions.length === 0) {
                vscode.window.showInformationMessage('No active debug sessions to stop.');
                return;
            }

            let targetSessionId = sessionId;

            // If no specific session ID provided, let user choose or use the only active session
            if (!targetSessionId) {
                if (activeSessions.length === 1) {
                    targetSessionId = activeSessions[0].id;
                } else {
                    const items = activeSessions.map(session => ({
                        label: path.basename(session.recipePath),
                        description: session.status,
                        sessionId: session.id
                    }));

                    const selected = await vscode.window.showQuickPick(items, {
                        placeHolder: 'Select debug session to stop'
                    });

                    if (!selected) {
                        return;
                    }

                    targetSessionId = selected.sessionId;
                }
            }

            await debugService.stopDebugSession(targetSessionId!);
            vscode.window.showInformationMessage('Debug session stopped.');

            this.services.logger.info(`Debug session stopped: ${targetSessionId}`);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Stop debug session failed', error);
            vscode.window.showErrorMessage(`Failed to stop debug session: ${message}`);
        }
    }

    /**
     * Toggle breakpoint at current line
     */
    private async toggleBreakpoint(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found.');
                return;
            }

            const filePath = editor.document.fileName;
            const line = editor.selection.active.line + 1; // Convert to 1-based line number

            if (!this.isRecipeFile(filePath)) {
                vscode.window.showErrorMessage('Breakpoints can only be set in recipe files.');
                return;
            }

            const debugService = this.services.debug as DebugService;
            const existingBreakpoints = debugService.getBreakpoints(filePath);
            const existingBreakpoint = existingBreakpoints.find(bp => bp.line === line);

            if (existingBreakpoint) {
                // Remove existing breakpoint
                await debugService.removeBreakpoint(existingBreakpoint.id);
                vscode.window.showInformationMessage(`Breakpoint removed at line ${line}`);
                this.services.logger.info(`Breakpoint removed: ${filePath}:${line}`);
            } else {
                // Add new breakpoint
                await debugService.setBreakpoint(filePath, line);
                vscode.window.showInformationMessage(`Breakpoint set at line ${line}`);
                this.services.logger.info(`Breakpoint added: ${filePath}:${line}`);
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Toggle breakpoint failed', error);
            vscode.window.showErrorMessage(`Failed to toggle breakpoint: ${message}`);
        }
    }

    /**
     * Continue execution from current breakpoint
     */
    private async continueExecution(): Promise<void> {
        try {
            const session = await this.getActiveSession();
            if (!session) {
                return;
            }

            const debugService = this.services.debug as DebugService;
            await debugService.continueExecution(session.id);

            this.services.logger.info(`Continued execution for session: ${session.id}`);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Continue execution failed', error);
            vscode.window.showErrorMessage(`Failed to continue execution: ${message}`);
        }
    }

    /**
     * Step over current line
     */
    private async stepOver(): Promise<void> {
        try {
            const session = await this.getActiveSession();
            if (!session) {
                return;
            }

            const debugService = this.services.debug as DebugService;
            await debugService.stepOver(session.id);

            this.services.logger.info(`Step over for session: ${session.id}`);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Step over failed', error);
            vscode.window.showErrorMessage(`Failed to step over: ${message}`);
        }
    }

    /**
     * Step into current method call
     */
    private async stepInto(): Promise<void> {
        try {
            const session = await this.getActiveSession();
            if (!session) {
                return;
            }

            const debugService = this.services.debug as DebugService;
            await debugService.stepInto(session.id);

            this.services.logger.info(`Step into for session: ${session.id}`);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Step into failed', error);
            vscode.window.showErrorMessage(`Failed to step into: ${message}`);
        }
    }

    /**
     * Step out of current method
     */
    private async stepOut(): Promise<void> {
        try {
            const session = await this.getActiveSession();
            if (!session) {
                return;
            }

            const debugService = this.services.debug as DebugService;
            await debugService.stepOut(session.id);

            this.services.logger.info(`Step out for session: ${session.id}`);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Step out failed', error);
            vscode.window.showErrorMessage(`Failed to step out: ${message}`);
        }
    }

    /**
     * Evaluate expression in debug context
     */
    private async evaluateExpression(): Promise<void> {
        try {
            const session = await this.getActiveSession();
            if (!session) {
                return;
            }

            const expression = await vscode.window.showInputBox({
                prompt: 'Enter expression to evaluate',
                placeHolder: 'e.g. cursor.getValue() or tree.getSimpleName()'
            });

            if (!expression) {
                return;
            }

            const debugService = this.services.debug as DebugService;
            const result = await debugService.evaluateExpression(session.id, expression);

            // Show result in information message and output channel
            vscode.window.showInformationMessage(`Result: ${result}`);
            
            const outputChannel = vscode.window.createOutputChannel('Moderne Debug Evaluation');
            outputChannel.appendLine(`Expression: ${expression}`);
            outputChannel.appendLine(`Result: ${result}`);
            outputChannel.show();

            this.services.logger.info(`Expression evaluated: ${expression} = ${result}`);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Evaluate expression failed', error);
            vscode.window.showErrorMessage(`Failed to evaluate expression: ${message}`);
        }
    }

    /**
     * Set conditional breakpoint
     */
    private async setConditionalBreakpoint(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found.');
                return;
            }

            const filePath = editor.document.fileName;
            const line = editor.selection.active.line + 1;

            if (!this.isRecipeFile(filePath)) {
                vscode.window.showErrorMessage('Breakpoints can only be set in recipe files.');
                return;
            }

            const condition = await vscode.window.showInputBox({
                prompt: 'Enter breakpoint condition',
                placeHolder: 'e.g. cursor.getValue().toString().contains("test")'
            });

            if (!condition) {
                return;
            }

            const debugService = this.services.debug as DebugService;
            await debugService.setBreakpoint(filePath, line, condition);

            vscode.window.showInformationMessage(`Conditional breakpoint set at line ${line}: ${condition}`);
            this.services.logger.info(`Conditional breakpoint added: ${filePath}:${line} [${condition}]`);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Set conditional breakpoint failed', error);
            vscode.window.showErrorMessage(`Failed to set conditional breakpoint: ${message}`);
        }
    }

    /**
     * Remove all breakpoints
     */
    private async removeAllBreakpoints(): Promise<void> {
        try {
            const debugService = this.services.debug as DebugService;
            const allBreakpoints = debugService.getBreakpoints();

            if (allBreakpoints.length === 0) {
                vscode.window.showInformationMessage('No breakpoints to remove.');
                return;
            }

            const confirmation = await vscode.window.showWarningMessage(
                `Remove all ${allBreakpoints.length} breakpoints?`,
                { modal: true },
                'Remove All',
                'Cancel'
            );

            if (confirmation !== 'Remove All') {
                return;
            }

            for (const breakpoint of allBreakpoints) {
                await debugService.removeBreakpoint(breakpoint.id);
            }

            vscode.window.showInformationMessage(`Removed ${allBreakpoints.length} breakpoints.`);
            this.services.logger.info(`Removed all breakpoints: ${allBreakpoints.length}`);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Remove all breakpoints failed', error);
            vscode.window.showErrorMessage(`Failed to remove breakpoints: ${message}`);
        }
    }

    // Private helper methods

    private async getActiveSession(): Promise<DebugSession | undefined> {
        const debugService = this.services.debug as DebugService;
        const activeSessions = debugService.getActiveSessions();

        if (activeSessions.length === 0) {
            vscode.window.showWarningMessage('No active debug sessions. Start debugging first.');
            return undefined;
        }

        if (activeSessions.length === 1) {
            return activeSessions[0];
        }

        // Multiple sessions - let user choose
        const items = activeSessions.map(session => ({
            label: path.basename(session.recipePath),
            description: session.status,
            session
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select debug session'
        });

        return selected?.session;
    }

    private async selectTargetPath(): Promise<string | undefined> {
        const options = [
            {
                label: '📁 Select Directory',
                description: 'Choose a directory to debug against',
                action: 'directory'
            },
            {
                label: '📄 Select File',
                description: 'Choose a specific file to debug against',
                action: 'file'
            },
            {
                label: '🏠 Use Current Workspace',
                description: 'Use the currently open workspace',
                action: 'workspace'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select target for debugging'
        });

        if (!selected) {
            return undefined;
        }

        switch (selected.action) {
            case 'directory':
                const dirResult = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: 'Select Target Directory'
                });
                return dirResult?.[0]?.fsPath;

            case 'file':
                const fileResult = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    openLabel: 'Select Target File',
                    filters: {
                        'Java files': ['java'],
                        'All files': ['*']
                    }
                });
                return fileResult?.[0]?.fsPath;

            case 'workspace':
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    vscode.window.showErrorMessage('No workspace is currently open.');
                    return undefined;
                }
                return workspaceFolder.uri.fsPath;

            default:
                return undefined;
        }
    }

    private isRecipeFile(filePath: string): boolean {
        if (!filePath.endsWith('.java')) {
            return false;
        }

        // This is a basic check - in a real implementation, we could parse the file
        // to check for @BeforeTemplate, @AfterTemplate, or Recipe class inheritance
        const fileName = path.basename(filePath);
        return fileName.toLowerCase().includes('recipe') || 
               fileName.toLowerCase().includes('refaster');
    }
}