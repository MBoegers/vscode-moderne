import * as vscode from 'vscode';

export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}

export class Logger {
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel = LogLevel.INFO;

    constructor(name: string) {
        this.outputChannel = vscode.window.createOutputChannel(name);
        this.updateLogLevel();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('moderne.logging.level')) {
                this.updateLogLevel();
            }
        });
    }

    private updateLogLevel(): void {
        const config = vscode.workspace.getConfiguration('moderne');
        const level = config.get<string>('logging.level', 'info');
        
        switch (level.toLowerCase()) {
            case 'error':
                this.logLevel = LogLevel.ERROR;
                break;
            case 'warn':
                this.logLevel = LogLevel.WARN;
                break;
            case 'info':
                this.logLevel = LogLevel.INFO;
                break;
            case 'debug':
                this.logLevel = LogLevel.DEBUG;
                break;
            default:
                this.logLevel = LogLevel.INFO;
        }
    }

    private formatMessage(level: string, message: string, error?: any): string {
        const timestamp = new Date().toISOString();
        let formatted = `[${timestamp}] [${level}] ${message}`;
        
        if (error) {
            if (error instanceof Error) {
                formatted += `\nError: ${error.message}`;
                if (error.stack) {
                    formatted += `\nStack: ${error.stack}`;
                }
            } else {
                formatted += `\nError: ${JSON.stringify(error)}`;
            }
        }
        
        return formatted;
    }

    private log(level: LogLevel, levelName: string, message: string, error?: any): void {
        if (level <= this.logLevel) {
            const formatted = this.formatMessage(levelName, message, error);
            this.outputChannel.appendLine(formatted);
            
            // Also log to console in development
            if (process.env.NODE_ENV === 'development') {
                console.log(formatted);
            }
        }
    }

    error(message: string, error?: any): void {
        this.log(LogLevel.ERROR, 'ERROR', message, error);
    }

    warn(message: string, error?: any): void {
        this.log(LogLevel.WARN, 'WARN', message, error);
    }

    info(message: string): void {
        this.log(LogLevel.INFO, 'INFO', message);
    }

    debug(message: string): void {
        this.log(LogLevel.DEBUG, 'DEBUG', message);
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}