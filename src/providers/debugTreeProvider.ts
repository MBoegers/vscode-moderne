import * as vscode from 'vscode';
import * as path from 'path';
import { DebugService, DebugSession, DebugBreakpoint, DebugVariable, DebugStackFrame } from '../services/debugService';
import { Logger } from '../utils/logger';

export class DebugTreeProvider implements vscode.TreeDataProvider<DebugTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DebugTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<DebugTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DebugTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private activeSessions: DebugSession[] = [];
    private selectedSession?: DebugSession;

    constructor(
        private debugService: DebugService,
        private logger: Logger
    ) {
        // Listen to debug service events
        this.debugService.onDidStartDebugSession(session => {
            this.activeSessions.push(session);
            this.refresh();
        });

        this.debugService.onDidTerminateDebugSession(session => {
            this.activeSessions = this.activeSessions.filter(s => s.id !== session.id);
            if (this.selectedSession?.id === session.id) {
                this.selectedSession = undefined;
            }
            this.refresh();
        });

        this.debugService.onDidStopOnBreakpoint(({ session, breakpoint }) => {
            const sessionIndex = this.activeSessions.findIndex(s => s.id === session.id);
            if (sessionIndex !== -1) {
                this.activeSessions[sessionIndex] = session;
                this.selectedSession = session;
                this.refresh();
            }
        });

        this.debugService.onDidUpdateVariables(({ session, variables }) => {
            const sessionIndex = this.activeSessions.findIndex(s => s.id === session.id);
            if (sessionIndex !== -1) {
                this.activeSessions[sessionIndex].variables = variables;
                this.refresh();
            }
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DebugTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DebugTreeItem): Thenable<DebugTreeItem[]> {
        if (!element) {
            return Promise.resolve(this.getRootItems());
        }

        if (element instanceof SessionItem) {
            return Promise.resolve(this.getSessionChildren(element.session));
        }

        if (element instanceof BreakpointsGroupItem) {
            return Promise.resolve(this.getBreakpointItems(element.session));
        }

        if (element instanceof VariablesGroupItem) {
            return Promise.resolve(this.getVariableItems(element.session));
        }

        if (element instanceof CallStackGroupItem) {
            return Promise.resolve(this.getCallStackItems(element.session));
        }

        if (element instanceof VariableItem && element.variable.expandable) {
            return Promise.resolve(this.getVariableChildren(element.variable));
        }

        return Promise.resolve([]);
    }

    /**
     * Select a debug session for detailed view
     */
    selectSession(session: DebugSession): void {
        this.selectedSession = session;
        this.refresh();
    }

    /**
     * Get root items for tree view
     */
    private getRootItems(): DebugTreeItem[] {
        this.activeSessions = this.debugService.getActiveSessions();

        if (this.activeSessions.length === 0) {
            return [new NoActiveSessionsItem()];
        }

        return this.activeSessions.map(session => new SessionItem(session));
    }

    /**
     * Get children for a debug session
     */
    private getSessionChildren(session: DebugSession): DebugTreeItem[] {
        const items: DebugTreeItem[] = [];

        // Session status
        items.push(new SessionStatusItem(session));

        // Breakpoints group
        if (session.breakpoints.length > 0) {
            items.push(new BreakpointsGroupItem(session));
        }

        // Variables group (only if session is paused)
        if (session.status === 'paused' && session.variables.length > 0) {
            items.push(new VariablesGroupItem(session));
        }

        // Call stack group (only if session is paused)
        if (session.status === 'paused' && session.callStack.length > 0) {
            items.push(new CallStackGroupItem(session));
        }

        return items;
    }

    /**
     * Get breakpoint items for a session
     */
    private getBreakpointItems(session: DebugSession): DebugTreeItem[] {
        return session.breakpoints.map(breakpoint => new BreakpointItem(breakpoint));
    }

    /**
     * Get variable items for a session
     */
    private getVariableItems(session: DebugSession): DebugTreeItem[] {
        return session.variables.map(variable => new VariableItem(variable));
    }

    /**
     * Get call stack items for a session
     */
    private getCallStackItems(session: DebugSession): DebugTreeItem[] {
        return session.callStack.map(frame => new CallStackItem(frame));
    }

    /**
     * Get children for an expandable variable
     */
    private getVariableChildren(variable: DebugVariable): DebugTreeItem[] {
        if (!variable.children) {
            return [];
        }
        return variable.children.map(child => new VariableItem(child));
    }
}

// Base class for debug tree items
abstract class DebugTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}

// Session item
class SessionItem extends DebugTreeItem {
    constructor(public readonly session: DebugSession) {
        super(
            `${path.basename(session.recipePath)} [${session.status}]`,
            vscode.TreeItemCollapsibleState.Expanded
        );

        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = 'debugSession';
        this.description = path.basename(session.targetPath);
    }

    private getTooltip(): string {
        return [
            `Session ID: ${this.session.id}`,
            `Recipe: ${this.session.recipePath}`,
            `Target: ${this.session.targetPath}`,
            `Status: ${this.session.status}`,
            `Breakpoints: ${this.session.breakpoints.length}`
        ].join('\n');
    }

    private getIcon(): vscode.ThemeIcon {
        switch (this.session.status) {
            case 'running':
                return new vscode.ThemeIcon('play', new vscode.ThemeColor('debugIcon.startForeground'));
            case 'paused':
                return new vscode.ThemeIcon('debug-pause', new vscode.ThemeColor('debugIcon.pauseForeground'));
            case 'stopped':
                return new vscode.ThemeIcon('debug-stop', new vscode.ThemeColor('debugIcon.stopForeground'));
            case 'error':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
            default:
                return new vscode.ThemeIcon('debug-start');
        }
    }
}

// Session status item
class SessionStatusItem extends DebugTreeItem {
    constructor(private session: DebugSession) {
        super(
            `Status: ${session.status}`,
            vscode.TreeItemCollapsibleState.None
        );

        this.iconPath = new vscode.ThemeIcon('info');
        this.contextValue = 'sessionStatus';
        
        if (session.currentBreakpoint) {
            this.description = `Stopped at line ${session.currentBreakpoint.line}`;
        }
    }
}

// Breakpoints group
class BreakpointsGroupItem extends DebugTreeItem {
    constructor(public readonly session: DebugSession) {
        super(
            `Breakpoints (${session.breakpoints.length})`,
            vscode.TreeItemCollapsibleState.Expanded
        );

        this.iconPath = new vscode.ThemeIcon('debug-breakpoint');
        this.contextValue = 'breakpointsGroup';
    }
}

// Individual breakpoint item
class BreakpointItem extends DebugTreeItem {
    constructor(public readonly breakpoint: DebugBreakpoint) {
        super(
            `Line ${breakpoint.line}`,
            vscode.TreeItemCollapsibleState.None
        );

        this.description = breakpoint.methodName || path.basename(breakpoint.filePath);
        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = 'breakpoint';

        // Command to navigate to breakpoint
        this.command = {
            command: 'vscode.open',
            title: 'Go to Breakpoint',
            arguments: [
                vscode.Uri.file(breakpoint.filePath),
                {
                    selection: new vscode.Range(
                        breakpoint.line - 1, breakpoint.column,
                        breakpoint.line - 1, breakpoint.column
                    )
                }
            ]
        };
    }

    private getTooltip(): string {
        const lines = [
            `File: ${this.breakpoint.filePath}`,
            `Line: ${this.breakpoint.line}`,
            `Enabled: ${this.breakpoint.enabled}`
        ];

        if (this.breakpoint.condition) {
            lines.push(`Condition: ${this.breakpoint.condition}`);
        }

        if (this.breakpoint.methodName) {
            lines.push(`Method: ${this.breakpoint.methodName}`);
        }

        return lines.join('\n');
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.breakpoint.enabled) {
            return new vscode.ThemeIcon('debug-breakpoint', new vscode.ThemeColor('debugIcon.breakpointForeground'));
        } else {
            return new vscode.ThemeIcon('debug-breakpoint-disabled', new vscode.ThemeColor('debugIcon.breakpointDisabledForeground'));
        }
    }
}

// Variables group
class VariablesGroupItem extends DebugTreeItem {
    constructor(public readonly session: DebugSession) {
        super(
            `Variables (${session.variables.length})`,
            vscode.TreeItemCollapsibleState.Expanded
        );

        this.iconPath = new vscode.ThemeIcon('symbol-variable');
        this.contextValue = 'variablesGroup';
    }
}

// Individual variable item
class VariableItem extends DebugTreeItem {
    constructor(public readonly variable: DebugVariable) {
        super(
            variable.name,
            variable.expandable ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
        );

        this.description = variable.value;
        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = 'variable';
    }

    private getTooltip(): string {
        return [
            `Name: ${this.variable.name}`,
            `Type: ${this.variable.type}`,
            `Value: ${this.variable.value}`,
            `Scope: ${this.variable.scope}`
        ].join('\n');
    }

    private getIcon(): vscode.ThemeIcon {
        switch (this.variable.scope) {
            case 'local':
                return new vscode.ThemeIcon('symbol-variable', new vscode.ThemeColor('symbolIcon.variableForeground'));
            case 'field':
                return new vscode.ThemeIcon('symbol-field', new vscode.ThemeColor('symbolIcon.fieldForeground'));
            case 'parameter':
                return new vscode.ThemeIcon('symbol-parameter', new vscode.ThemeColor('symbolIcon.parameterForeground'));
            default:
                return new vscode.ThemeIcon('symbol-variable');
        }
    }
}

// Call stack group
class CallStackGroupItem extends DebugTreeItem {
    constructor(public readonly session: DebugSession) {
        super(
            `Call Stack (${session.callStack.length})`,
            vscode.TreeItemCollapsibleState.Expanded
        );

        this.iconPath = new vscode.ThemeIcon('list-ordered');
        this.contextValue = 'callStackGroup';
    }
}

// Call stack frame item
class CallStackItem extends DebugTreeItem {
    constructor(public readonly frame: DebugStackFrame) {
        super(
            frame.name,
            vscode.TreeItemCollapsibleState.None
        );

        this.description = `${path.basename(frame.source)}:${frame.line}`;
        this.tooltip = `${frame.source}:${frame.line}:${frame.column}`;
        this.iconPath = new vscode.ThemeIcon('symbol-method');
        this.contextValue = 'stackFrame';

        // Command to navigate to stack frame
        this.command = {
            command: 'vscode.open',
            title: 'Go to Stack Frame',
            arguments: [
                vscode.Uri.file(frame.source),
                {
                    selection: new vscode.Range(
                        frame.line - 1, frame.column,
                        frame.line - 1, frame.column
                    )
                }
            ]
        };
    }
}

// No active sessions item
class NoActiveSessionsItem extends DebugTreeItem {
    constructor() {
        super('No active debug sessions', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('debug-start');
        this.contextValue = 'noActiveSessions';
        this.tooltip = 'Start debugging a recipe to see debug information here';
    }
}