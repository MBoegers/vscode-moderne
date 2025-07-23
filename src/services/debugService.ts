import * as vscode from 'vscode';
import * as path from 'path';
import { CliService } from './cliService';
import { ConfigService } from './configService';
import { Logger } from '../utils/logger';

export interface DebugBreakpoint {
    id: string;
    filePath: string;
    line: number;
    column: number;
    condition?: string;
    enabled: boolean;
    recipeClass?: string;
    methodName?: string;
}

export interface DebugSession {
    id: string;
    recipePath: string;
    targetPath: string;
    breakpoints: DebugBreakpoint[];
    status: 'starting' | 'running' | 'paused' | 'stopped' | 'error';
    currentBreakpoint?: DebugBreakpoint;
    variables: DebugVariable[];
    callStack: DebugStackFrame[];
}

export interface DebugVariable {
    name: string;
    value: string;
    type: string;
    scope: 'local' | 'field' | 'parameter';
    expandable: boolean;
    children?: DebugVariable[];
}

export interface DebugStackFrame {
    id: string;
    name: string;
    source: string;
    line: number;
    column: number;
}

export interface DebugConfiguration {
    recipePath: string;
    targetPath: string;
    breakpoints: DebugBreakpoint[];
    enableLiveEdit: boolean;
    showInternalMethods: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export class DebugService {
    private cliService: CliService;
    private configService: ConfigService;
    private logger: Logger;
    private activeSessions: Map<string, DebugSession> = new Map();
    private breakpoints: Map<string, DebugBreakpoint[]> = new Map();
    private debugOutputChannel: vscode.OutputChannel;

    // Event emitters for debug events
    private _onDidStartDebugSession = new vscode.EventEmitter<DebugSession>();
    private _onDidTerminateDebugSession = new vscode.EventEmitter<DebugSession>();
    private _onDidStopOnBreakpoint = new vscode.EventEmitter<{ session: DebugSession; breakpoint: DebugBreakpoint }>();
    private _onDidUpdateVariables = new vscode.EventEmitter<{ session: DebugSession; variables: DebugVariable[] }>();

    readonly onDidStartDebugSession = this._onDidStartDebugSession.event;
    readonly onDidTerminateDebugSession = this._onDidTerminateDebugSession.event;
    readonly onDidStopOnBreakpoint = this._onDidStopOnBreakpoint.event;
    readonly onDidUpdateVariables = this._onDidUpdateVariables.event;

    constructor(
        cliService: CliService,
        configService: ConfigService,
        logger: Logger
    ) {
        this.cliService = cliService;
        this.configService = configService;
        this.logger = logger;
        this.debugOutputChannel = vscode.window.createOutputChannel('Moderne Recipe Debug');
    }

    /**
     * Start a new debug session for a recipe
     */
    async startDebugSession(config: DebugConfiguration): Promise<DebugSession> {
        const sessionId = this.generateSessionId();
        
        this.logger.info(`Starting debug session ${sessionId} for recipe: ${config.recipePath}`);
        this.debugOutputChannel.show();
        this.debugOutputChannel.appendLine(`🚀 Starting debug session for ${path.basename(config.recipePath)}`);

        try {
            // Validate recipe file
            await this.validateRecipeFile(config.recipePath);
            
            // Validate target path
            await this.validateTargetPath(config.targetPath);

            // Create debug session
            const session: DebugSession = {
                id: sessionId,
                recipePath: config.recipePath,
                targetPath: config.targetPath,
                breakpoints: config.breakpoints,
                status: 'starting',
                variables: [],
                callStack: []
            };

            this.activeSessions.set(sessionId, session);

            // Setup breakpoints in the recipe
            await this.setupBreakpoints(session);

            // Start the debug CLI process
            await this.startDebugCliProcess(session, config);

            session.status = 'running';
            this._onDidStartDebugSession.fire(session);

            this.logger.info(`Debug session ${sessionId} started successfully`);
            return session;

        } catch (error) {
            this.logger.error(`Failed to start debug session: ${error}`);
            this.debugOutputChannel.appendLine(`❌ Failed to start debug session: ${error}`);
            throw error;
        }
    }

    /**
     * Stop a debug session
     */
    async stopDebugSession(sessionId: string): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        this.logger.info(`Stopping debug session ${sessionId}`);
        this.debugOutputChannel.appendLine(`🛑 Stopping debug session ${sessionId}`);

        try {
            // Stop the CLI debug process
            await this.stopDebugCliProcess(session);

            // Clean up breakpoints
            await this.cleanupBreakpoints(session);

            session.status = 'stopped';
            this._onDidTerminateDebugSession.fire(session);

            this.activeSessions.delete(sessionId);
            this.logger.info(`Debug session ${sessionId} stopped successfully`);

        } catch (error) {
            this.logger.error(`Error stopping debug session ${sessionId}: ${error}`);
            throw error;
        }
    }

    /**
     * Add or update a breakpoint
     */
    async setBreakpoint(filePath: string, line: number, condition?: string): Promise<DebugBreakpoint> {
        const breakpointId = this.generateBreakpointId();
        
        const breakpoint: DebugBreakpoint = {
            id: breakpointId,
            filePath,
            line,
            column: 0,
            condition,
            enabled: true,
            recipeClass: await this.extractRecipeClass(filePath),
            methodName: await this.extractMethodAtLine(filePath, line)
        };

        // Store breakpoint
        const fileBreakpoints = this.breakpoints.get(filePath) || [];
        fileBreakpoints.push(breakpoint);
        this.breakpoints.set(filePath, fileBreakpoints);

        // Apply to active sessions
        for (const session of this.activeSessions.values()) {
            if (session.recipePath === filePath) {
                session.breakpoints.push(breakpoint);
                await this.applyBreakpointToSession(session, breakpoint);
            }
        }

        this.logger.info(`Breakpoint set at ${filePath}:${line}`);
        return breakpoint;
    }

    /**
     * Remove a breakpoint
     */
    async removeBreakpoint(breakpointId: string): Promise<void> {
        for (const [filePath, breakpoints] of this.breakpoints.entries()) {
            const index = breakpoints.findIndex(bp => bp.id === breakpointId);
            if (index !== -1) {
                const breakpoint = breakpoints[index];
                breakpoints.splice(index, 1);
                
                if (breakpoints.length === 0) {
                    this.breakpoints.delete(filePath);
                }

                // Remove from active sessions
                for (const session of this.activeSessions.values()) {
                    const sessionIndex = session.breakpoints.findIndex(bp => bp.id === breakpointId);
                    if (sessionIndex !== -1) {
                        session.breakpoints.splice(sessionIndex, 1);
                        await this.removeBreakpointFromSession(session, breakpoint);
                    }
                }

                this.logger.info(`Breakpoint ${breakpointId} removed`);
                return;
            }
        }

        throw new Error(`Breakpoint ${breakpointId} not found`);
    }

    /**
     * Continue execution from a breakpoint
     */
    async continueExecution(sessionId: string): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        if (session.status !== 'paused') {
            throw new Error(`Debug session ${sessionId} is not paused`);
        }

        this.logger.info(`Continuing execution for session ${sessionId}`);
        this.debugOutputChannel.appendLine(`▶️ Continuing execution...`);

        try {
            await this.sendDebugCommand(session, 'continue');
            session.status = 'running';
            session.currentBreakpoint = undefined;

        } catch (error) {
            this.logger.error(`Failed to continue execution: ${error}`);
            throw error;
        }
    }

    /**
     * Step over current line
     */
    async stepOver(sessionId: string): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (!session || session.status !== 'paused') {
            throw new Error(`Invalid session state for step over`);
        }

        this.logger.info(`Step over for session ${sessionId}`);
        await this.sendDebugCommand(session, 'step_over');
    }

    /**
     * Step into current method call
     */
    async stepInto(sessionId: string): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (!session || session.status !== 'paused') {
            throw new Error(`Invalid session state for step into`);
        }

        this.logger.info(`Step into for session ${sessionId}`);
        await this.sendDebugCommand(session, 'step_into');
    }

    /**
     * Step out of current method
     */
    async stepOut(sessionId: string): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (!session || session.status !== 'paused') {
            throw new Error(`Invalid session state for step out`);
        }

        this.logger.info(`Step out for session ${sessionId}`);
        await this.sendDebugCommand(session, 'step_out');
    }

    /**
     * Get current variables for a debug session
     */
    async getVariables(sessionId: string, scope?: string): Promise<DebugVariable[]> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        try {
            const variables = await this.fetchVariablesFromDebugger(session, scope);
            session.variables = variables;
            this._onDidUpdateVariables.fire({ session, variables });
            return variables;

        } catch (error) {
            this.logger.error(`Failed to get variables for session ${sessionId}: ${error}`);
            return [];
        }
    }

    /**
     * Get call stack for a debug session
     */
    async getCallStack(sessionId: string): Promise<DebugStackFrame[]> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        try {
            const callStack = await this.fetchCallStackFromDebugger(session);
            session.callStack = callStack;
            return callStack;

        } catch (error) {
            this.logger.error(`Failed to get call stack for session ${sessionId}: ${error}`);
            return [];
        }
    }

    /**
     * Evaluate an expression in debug context
     */
    async evaluateExpression(sessionId: string, expression: string): Promise<string> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        try {
            return await this.sendDebugCommand(session, 'evaluate', { expression });
        } catch (error) {
            this.logger.error(`Failed to evaluate expression: ${error}`);
            throw error;
        }
    }

    /**
     * Get all active debug sessions
     */
    getActiveSessions(): DebugSession[] {
        return Array.from(this.activeSessions.values());
    }

    /**
     * Get breakpoints for a file
     */
    getBreakpoints(filePath?: string): DebugBreakpoint[] {
        if (filePath) {
            return this.breakpoints.get(filePath) || [];
        }

        const allBreakpoints: DebugBreakpoint[] = [];
        for (const breakpoints of this.breakpoints.values()) {
            allBreakpoints.push(...breakpoints);
        }
        return allBreakpoints;
    }

    // Private helper methods

    private generateSessionId(): string {
        return `debug-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateBreakpointId(): string {
        return `breakpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private async validateRecipeFile(recipePath: string): Promise<void> {
        const fs = require('fs-extra');
        
        if (!await fs.pathExists(recipePath)) {
            throw new Error(`Recipe file not found: ${recipePath}`);
        }

        const content = await fs.readFile(recipePath, 'utf8');
        
        // Basic validation for OpenRewrite recipe structure
        if (!content.includes('@BeforeTemplate') && !content.includes('@AfterTemplate') &&
            !content.includes('class') && !content.includes('Recipe')) {
            throw new Error(`File does not appear to be a valid OpenRewrite recipe: ${recipePath}`);
        }
    }

    private async validateTargetPath(targetPath: string): Promise<void> {
        const fs = require('fs-extra');
        
        if (!await fs.pathExists(targetPath)) {
            throw new Error(`Target path not found: ${targetPath}`);
        }
    }

    private async setupBreakpoints(session: DebugSession): Promise<void> {
        this.debugOutputChannel.appendLine(`📍 Setting up ${session.breakpoints.length} breakpoints`);
        
        for (const breakpoint of session.breakpoints) {
            await this.applyBreakpointToSession(session, breakpoint);
        }
    }

    private async applyBreakpointToSession(session: DebugSession, breakpoint: DebugBreakpoint): Promise<void> {
        try {
            await this.sendDebugCommand(session, 'set_breakpoint', {
                file: breakpoint.filePath,
                line: breakpoint.line,
                condition: breakpoint.condition
            });

            this.debugOutputChannel.appendLine(
                `✓ Breakpoint set at ${path.basename(breakpoint.filePath)}:${breakpoint.line}`
            );

        } catch (error) {
            this.debugOutputChannel.appendLine(
                `❌ Failed to set breakpoint at ${path.basename(breakpoint.filePath)}:${breakpoint.line}: ${error}`
            );
        }
    }

    private async removeBreakpointFromSession(session: DebugSession, breakpoint: DebugBreakpoint): Promise<void> {
        await this.sendDebugCommand(session, 'remove_breakpoint', {
            file: breakpoint.filePath,
            line: breakpoint.line
        });
    }

    private async cleanupBreakpoints(session: DebugSession): Promise<void> {
        for (const breakpoint of session.breakpoints) {
            await this.removeBreakpointFromSession(session, breakpoint);
        }
    }

    private async startDebugCliProcess(session: DebugSession, config: DebugConfiguration): Promise<void> {
        const args = [
            'debug',
            '--recipe-path', session.recipePath,
            '--target-path', session.targetPath,
            '--mode', 'attach',
            '--port', '5005' // Default debug port
        ];

        if (config.enableLiveEdit) {
            args.push('--live-edit');
        }

        if (config.showInternalMethods) {
            args.push('--show-internal');
        }

        args.push('--log-level', config.logLevel);

        // Start the CLI debug process (this would be implementation-specific)
        this.debugOutputChannel.appendLine(`🔧 Starting debug CLI: mod ${args.join(' ')}`);
        
        // In a real implementation, this would start the actual debug process
        // For now, we'll simulate the process starting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    private async stopDebugCliProcess(session: DebugSession): Promise<void> {
        // Stop the CLI debug process
        await this.sendDebugCommand(session, 'terminate');
    }

    private async sendDebugCommand(session: DebugSession, command: string, params?: any): Promise<string> {
        // This would send commands to the debug CLI process
        // For now, we'll simulate command execution
        this.debugOutputChannel.appendLine(`🔧 Debug command: ${command} ${params ? JSON.stringify(params) : ''}`);
        
        // Simulate command execution
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return 'OK';
    }

    private async fetchVariablesFromDebugger(session: DebugSession, scope?: string): Promise<DebugVariable[]> {
        // Fetch variables from the debugger
        // This would interact with the actual debug CLI
        return [
            {
                name: 'cursor',
                value: 'JavaCoordinates{...}',
                type: 'org.openrewrite.Cursor',
                scope: 'local',
                expandable: true
            },
            {
                name: 'tree',
                value: 'J.MethodDeclaration{...}',
                type: 'org.openrewrite.java.tree.J.MethodDeclaration',
                scope: 'parameter',
                expandable: true
            }
        ];
    }

    private async fetchCallStackFromDebugger(session: DebugSession): Promise<DebugStackFrame[]> {
        // Fetch call stack from the debugger
        return [
            {
                id: 'frame-1',
                name: 'visitMethodDeclaration',
                source: session.recipePath,
                line: session.currentBreakpoint?.line || 1,
                column: 0
            }
        ];
    }

    private async extractRecipeClass(filePath: string): Promise<string | undefined> {
        try {
            const fs = require('fs-extra');
            const content = await fs.readFile(filePath, 'utf8');
            
            // Extract class name from Java file
            const classMatch = content.match(/public\s+class\s+(\w+)/);
            return classMatch ? classMatch[1] : undefined;
        } catch (error) {
            return undefined;
        }
    }

    private async extractMethodAtLine(filePath: string, line: number): Promise<string | undefined> {
        try {
            const fs = require('fs-extra');
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            
            // Look backwards from the line to find method declaration
            for (let i = line - 1; i >= 0; i--) {
                const methodMatch = lines[i].match(/(?:public|private|protected)?\s*\w+\s+(\w+)\s*\(/);
                if (methodMatch) {
                    return methodMatch[1];
                }
            }
            
            return undefined;
        } catch (error) {
            return undefined;
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        // Stop all active sessions
        for (const sessionId of this.activeSessions.keys()) {
            this.stopDebugSession(sessionId).catch(error => {
                this.logger.error(`Error stopping session during disposal: ${error}`);
            });
        }

        this.debugOutputChannel.dispose();
        this._onDidStartDebugSession.dispose();
        this._onDidTerminateDebugSession.dispose();
        this._onDidStopOnBreakpoint.dispose();
        this._onDidUpdateVariables.dispose();
    }
}