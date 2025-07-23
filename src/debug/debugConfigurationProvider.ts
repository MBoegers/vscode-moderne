import * as vscode from 'vscode';
import * as path from 'path';
import { DebugService } from '../services/debugService';
import { Logger } from '../utils/logger';

export interface ModerneDebugConfiguration extends vscode.DebugConfiguration {
    type: 'moderne-recipe';
    name: string;
    request: 'launch' | 'attach';
    recipePath: string;
    targetPath: string;
    enableLiveEdit?: boolean;
    showInternalMethods?: boolean;
    logLevel?: 'error' | 'warn' | 'info' | 'debug';
    port?: number;
    debugPort?: number;
}

export class DebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    constructor(
        private debugService: DebugService,
        private logger: Logger
    ) {}

    /**
     * Provide initial debug configurations for launch.json
     */
    provideDebugConfigurations(
        folder: vscode.WorkspaceFolder | undefined, 
        token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration[]> {
        
        const configurations: ModerneDebugConfiguration[] = [
            {
                type: 'moderne-recipe',
                name: 'Debug Current Recipe',
                request: 'launch',
                recipePath: '${file}',
                targetPath: '${workspaceFolder}',
                enableLiveEdit: true,
                showInternalMethods: false,
                logLevel: 'debug'
            },
            {
                type: 'moderne-recipe',
                name: 'Debug Recipe with Selection',
                request: 'launch',
                recipePath: '${file}',
                targetPath: '${input:targetPath}',
                enableLiveEdit: true,
                showInternalMethods: false,
                logLevel: 'debug'
            },
            {
                type: 'moderne-recipe',
                name: 'Attach to Running Recipe',
                request: 'attach',
                recipePath: '${file}',
                targetPath: '${workspaceFolder}',
                port: 5005,
                logLevel: 'debug'
            }
        ];

        return configurations;
    }

    /**
     * Resolve debug configuration before starting debug session
     */
    resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder | undefined,
        config: ModerneDebugConfiguration,
        token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration> {

        // Basic validation
        if (!config.type || config.type !== 'moderne-recipe') {
            return null;
        }

        // Set defaults
        config.enableLiveEdit = config.enableLiveEdit ?? true;
        config.showInternalMethods = config.showInternalMethods ?? false;
        config.logLevel = config.logLevel ?? 'debug';
        config.port = config.port ?? 5005;

        // Resolve variables in recipePath
        if (config.recipePath === '${file}') {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                vscode.window.showErrorMessage('No active editor found. Please open a recipe file.');
                return null;
            }
            config.recipePath = activeEditor.document.fileName;
        }

        // Validate recipe file
        if (!this.isValidRecipeFile(config.recipePath)) {
            vscode.window.showErrorMessage('Selected file is not a valid OpenRewrite recipe.');
            return null;
        }

        // Resolve variables in targetPath
        if (config.targetPath === '${workspaceFolder}') {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder is open.');
                return null;
            }
            config.targetPath = workspaceFolder.uri.fsPath;
        }

        this.logger.info(`Resolved debug configuration: ${JSON.stringify(config, null, 2)}`);
        return config;
    }

    /**
     * Resolve debug configuration with substituted variables
     */
    resolveDebugConfigurationWithSubstitutedVariables(
        folder: vscode.WorkspaceFolder | undefined,
        config: ModerneDebugConfiguration,
        token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration> {

        // Final validation before launching
        if (!config.recipePath || !config.targetPath) {
            vscode.window.showErrorMessage('Recipe path and target path must be specified.');
            return null;
        }

        // Check if recipe file exists
        const fs = require('fs-extra');
        if (!fs.existsSync(config.recipePath)) {
            vscode.window.showErrorMessage(`Recipe file not found: ${config.recipePath}`);
            return null;
        }

        // Check if target path exists
        if (!fs.existsSync(config.targetPath)) {
            vscode.window.showErrorMessage(`Target path not found: ${config.targetPath}`);
            return null;
        }

        return config;
    }

    private isValidRecipeFile(filePath: string): boolean {
        if (!filePath.endsWith('.java')) {
            return false;
        }

        try {
            const fs = require('fs-extra');
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for OpenRewrite recipe indicators
            return (
                content.includes('@BeforeTemplate') ||
                content.includes('@AfterTemplate') ||
                content.includes('extends Recipe') ||
                content.includes('implements Recipe')
            );
        } catch (error) {
            return false;
        }
    }
}

export class DebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
    constructor(
        private debugService: DebugService,
        private logger: Logger
    ) {}

    createDebugAdapterDescriptor(
        session: vscode.DebugSession,
        executable: vscode.DebugAdapterExecutable | undefined
    ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {

        const config = session.configuration as ModerneDebugConfiguration;
        
        this.logger.info(`Creating debug adapter for session: ${session.name}`);

        // Return inline debug adapter that uses our DebugService
        return new vscode.DebugAdapterInlineImplementation(
            new ModerneDebugAdapter(this.debugService, this.logger, config)
        );
    }
}

class ModerneDebugAdapter implements vscode.DebugAdapter {
    private sendMessage = new vscode.EventEmitter<vscode.DebugProtocolMessage>();
    private debugSession?: any;

    readonly onDidSendMessage: vscode.Event<vscode.DebugProtocolMessage> = this.sendMessage.event;

    constructor(
        private debugService: DebugService,
        private logger: Logger,
        private config: ModerneDebugConfiguration
    ) {}

    handleMessage(message: vscode.DebugProtocolMessage): void {
        const msgType = (message as any).type;
        this.logger.debug(`Debug adapter received message: ${msgType}`);

        switch (msgType) {
            case 'request':
                this.handleRequest(message as any);
                break;
            default:
                this.logger.warn(`Unhandled debug message type: ${msgType}`);
        }
    }

    private async handleRequest(request: any): Promise<void> {
        try {
            switch (request.command) {
                case 'initialize':
                    await this.handleInitialize(request);
                    break;
                
                case 'launch':
                    await this.handleLaunch(request);
                    break;
                
                case 'attach':
                    await this.handleAttach(request);
                    break;
                
                case 'setBreakpoints':
                    await this.handleSetBreakpoints(request);
                    break;
                
                case 'continue':
                    await this.handleContinue(request);
                    break;
                
                case 'next':
                    await this.handleNext(request);
                    break;
                
                case 'stepIn':
                    await this.handleStepIn(request);
                    break;
                
                case 'stepOut':
                    await this.handleStepOut(request);
                    break;
                
                case 'scopes':
                    await this.handleScopes(request);
                    break;
                
                case 'variables':
                    await this.handleVariables(request);
                    break;
                
                case 'evaluate':
                    await this.handleEvaluate(request);
                    break;
                
                case 'stackTrace':
                    await this.handleStackTrace(request);
                    break;
                
                case 'disconnect':
                    await this.handleDisconnect(request);
                    break;
                
                default:
                    this.sendErrorResponse(request, `Unhandled request: ${request.command}`);
            }
        } catch (error) {
            this.logger.error(`Error handling debug request ${request.command}:`, error);
            this.sendErrorResponse(request, `Error: ${error}`);
        }
    }

    private async handleInitialize(request: any): Promise<void> {
        // Send initialize response with capabilities
        this.sendResponse(request, {
            supportsConfigurationDoneRequest: true,
            supportsEvaluateForHovers: true,
            supportsStepBack: false,
            supportsSetVariable: false,
            supportsRestartFrame: false,
            supportsGotoTargetsRequest: false,
            supportsStepInTargetsRequest: false,
            supportsCompletionsRequest: false,
            supportsModulesRequest: false,
            supportsExceptionOptions: false,
            supportsValueFormattingOptions: true,
            supportsExceptionInfoRequest: false,
            supportTerminateDebuggee: true,
            supportsDelayedStackTraceLoading: false,
            supportsLoadedSourcesRequest: false,
            supportsLogPoints: false,
            supportsTerminateThreadsRequest: false,
            supportsSetExpression: false,
            supportsTerminateRequest: true,
            completionTriggerCharacters: ['.', '['],
            supportsBreakpointLocationsRequest: false
        });

        // Send initialized event
        this.sendEvent('initialized');
    }

    private async handleLaunch(request: any): Promise<void> {
        const debugConfig = {
            recipePath: this.config.recipePath,
            targetPath: this.config.targetPath,
            breakpoints: [],
            enableLiveEdit: this.config.enableLiveEdit || false,
            showInternalMethods: this.config.showInternalMethods || false,
            logLevel: this.config.logLevel || 'debug'
        };

        // Start debug session using our DebugService
        this.debugSession = await this.debugService.startDebugSession(debugConfig);
        
        this.sendResponse(request);
        this.sendEvent('process', {
            name: path.basename(this.config.recipePath),
            systemProcessId: Date.now(), // Mock process ID
            isLocalProcess: true,
            startMethod: 'launch'
        });
    }

    private async handleAttach(request: any): Promise<void> {
        // For attach mode, we would connect to an existing debug process
        this.sendResponse(request);
        this.sendEvent('process', {
            name: path.basename(this.config.recipePath),
            systemProcessId: Date.now(),
            isLocalProcess: true,
            startMethod: 'attach'
        });
    }

    private async handleSetBreakpoints(request: any): Promise<void> {
        const source = request.arguments.source;
        const breakpoints = request.arguments.breakpoints || [];
        
        const responseBreakpoints = [];
        
        for (const bp of breakpoints) {
            try {
                const breakpoint = await this.debugService.setBreakpoint(
                    source.path,
                    bp.line,
                    bp.condition
                );
                
                responseBreakpoints.push({
                    id: parseInt(breakpoint.id.split('-')[2], 36), // Convert ID to number
                    verified: true,
                    line: bp.line,
                    source: source
                });
            } catch (error) {
                responseBreakpoints.push({
                    verified: false,
                    line: bp.line,
                    message: `Failed to set breakpoint: ${error}`
                });
            }
        }

        this.sendResponse(request, { breakpoints: responseBreakpoints });
    }

    private async handleContinue(request: any): Promise<void> {
        if (this.debugSession) {
            await this.debugService.continueExecution(this.debugSession.id);
        }
        this.sendResponse(request, { allThreadsContinued: true });
    }

    private async handleNext(request: any): Promise<void> {
        if (this.debugSession) {
            await this.debugService.stepOver(this.debugSession.id);
        }
        this.sendResponse(request);
    }

    private async handleStepIn(request: any): Promise<void> {
        if (this.debugSession) {
            await this.debugService.stepInto(this.debugSession.id);
        }
        this.sendResponse(request);
    }

    private async handleStepOut(request: any): Promise<void> {
        if (this.debugSession) {
            await this.debugService.stepOut(this.debugSession.id);
        }
        this.sendResponse(request);
    }

    private async handleScopes(request: any): Promise<void> {
        const scopes = [
            {
                name: 'Local',
                variablesReference: 1,
                expensive: false
            },
            {
                name: 'Fields',
                variablesReference: 2,
                expensive: false
            }
        ];

        this.sendResponse(request, { scopes });
    }

    private async handleVariables(request: any): Promise<void> {
        if (!this.debugSession) {
            this.sendResponse(request, { variables: [] });
            return;
        }

        const variables = await this.debugService.getVariables(this.debugSession.id);
        const responseVariables = variables.map((variable, index) => ({
            name: variable.name,
            value: variable.value,
            type: variable.type,
            variablesReference: variable.expandable ? index + 100 : 0
        }));

        this.sendResponse(request, { variables: responseVariables });
    }

    private async handleEvaluate(request: any): Promise<void> {
        if (!this.debugSession) {
            this.sendErrorResponse(request, 'No active debug session');
            return;
        }

        try {
            const result = await this.debugService.evaluateExpression(
                this.debugSession.id,
                request.arguments.expression
            );

            this.sendResponse(request, {
                result,
                variablesReference: 0
            });
        } catch (error) {
            this.sendErrorResponse(request, `Evaluation failed: ${error}`);
        }
    }

    private async handleStackTrace(request: any): Promise<void> {
        if (!this.debugSession) {
            this.sendResponse(request, { stackFrames: [], totalFrames: 0 });
            return;
        }

        const callStack = await this.debugService.getCallStack(this.debugSession.id);
        const stackFrames = callStack.map((frame, index) => ({
            id: index,
            name: frame.name,
            source: {
                name: path.basename(frame.source),
                path: frame.source
            },
            line: frame.line,
            column: frame.column
        }));

        this.sendResponse(request, {
            stackFrames,
            totalFrames: stackFrames.length
        });
    }

    private async handleDisconnect(request: any): Promise<void> {
        if (this.debugSession) {
            await this.debugService.stopDebugSession(this.debugSession.id);
        }
        this.sendResponse(request);
    }

    private sendResponse(request: any, body?: any): void {
        const response = {
            type: 'response',
            request_seq: request.seq,
            success: true,
            command: request.command,
            body
        };
        this.sendMessage.fire(response);
    }

    private sendErrorResponse(request: any, message: string): void {
        const response = {
            type: 'response',
            request_seq: request.seq,
            success: false,
            command: request.command,
            message
        };
        this.sendMessage.fire(response);
    }

    private sendEvent(event: string, body?: any): void {
        const eventMessage = {
            type: 'event',
            event,
            body
        };
        this.sendMessage.fire(eventMessage);
    }

    dispose(): void {
        // Cleanup resources
    }
}