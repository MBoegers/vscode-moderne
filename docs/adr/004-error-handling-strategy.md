# ADR-004: Error Handling Strategy

**Date:** 2025-07-23  
**Status:** Accepted  
**Context:** VSCode Moderne Extension - Error Handling and User Experience

## Context

The VSCode Moderne Extension interacts with external CLI tools, file systems, and network resources, all of which can fail in various ways. We need a comprehensive error handling strategy that provides good user experience, helpful debugging information, and graceful degradation when possible.

## Decision

We will implement a **multi-layered error handling strategy** with custom error types, comprehensive logging, user-friendly messaging, and graceful degradation for non-critical features.

### Error Handling Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   User Experience Layer                     │
│              (Friendly messages, actions)                   │
├─────────────────────────────────────────────────────────────┤
│                   Error Classification                      │
│            (Custom error types, categorization)             │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                           │
│              (Error detection, initial handling)            │
├─────────────────────────────────────────────────────────────┤
│                    Logging Layer                           │
│                (Detailed debugging info)                    │
└─────────────────────────────────────────────────────────────┘
```

### Custom Error Types

```typescript
export class CliError extends Error {
    constructor(
        message: string,
        public exitCode?: number,
        public stderr?: string,
        public stdout?: string
    ) {
        super(message);
        this.name = 'CliError';
    }
}

export class ConfigurationError extends Error {
    constructor(message: string, public configPath?: string) {
        super(message);
        this.name = 'ConfigurationError';
    }
}

export class LicenseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LicenseError';
    }
}
```

### Error Handler Implementation

```typescript
export class ErrorHandler {
    static handle(error: Error, context: string, logger: Logger): void {
        if (error instanceof CliError) {
            this.handleCliError(error, context, logger);
        } else if (error instanceof ConfigurationError) {
            this.handleConfigError(error, context, logger);
        } else if (error instanceof LicenseError) {
            this.handleLicenseError(error, context, logger);
        } else {
            this.handleGenericError(error, context, logger);
        }
    }
    
    private static showUserMessage(
        message: string, 
        type: 'error' | 'warning' | 'info',
        actions?: string[]
    ): void {
        // VSCode notification with appropriate severity and action buttons
    }
}
```

## Rationale

### Error Categories

1. **CLI Errors**: Moderne CLI execution failures, timeouts, invalid responses
2. **Configuration Errors**: Invalid settings, missing required values
3. **License Errors**: License validation failures, expired licenses
4. **Network Errors**: Organization access, repository cloning issues
5. **File System Errors**: Permission issues, missing files
6. **Parsing Errors**: Invalid recipe formats, malformed CLI responses

### Design Principles

#### 1. Fail Fast for Critical Errors
**Rationale**: Extension activation should fail immediately for critical issues rather than providing broken functionality.

#### 2. Graceful Degradation for Non-Critical Features
**Rationale**: Users should be able to use basic functionality even if advanced features fail.

#### 3. User-Friendly Error Messages
**Rationale**: Technical error messages should be translated to actionable user guidance.

#### 4. Comprehensive Logging for Debugging
**Rationale**: Detailed technical information should be available for troubleshooting without overwhelming users.

### Implementation Details

#### Extension Activation Error Handling
```typescript
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        // Critical initialization (must succeed)
        const services = await initializeCoreServices(context);
        registerCommands(context, services);
        
        // Non-critical initialization (can fail gracefully)
        initializeStatusBar(services).catch(error => {
            logger.warn('Status bar initialization failed', error);
            // Extension continues without status bar
        });
        
        performInitialValidation(services).catch(error => {
            logger.warn('Initial CLI validation failed', error);
            // Extension continues with CLI unavailable warnings
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to activate Moderne extension: ${errorMessage}`);
        if (logger) {
            logger.error('Extension activation failed', error);
        }
        throw error; // Fail activation for critical errors
    }
}
```

#### CLI Error Processing
```typescript
async executeCommand(args: string[]): Promise<CliResult> {
    try {
        const result = await this.runCliCommand(args);
        return result;
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('ENOENT')) {
                throw new CliError(
                    'Moderne CLI not found. Please check your CLI configuration.',
                    -1,
                    error.message
                );
            } else if (error.message.includes('timeout')) {
                throw new CliError(
                    'CLI operation timed out. The operation may have been too complex.',
                    -1,
                    error.message
                );
            }
        }
        throw new CliError('CLI operation failed', -1, String(error));
    }
}
```

#### User-Friendly Error Presentation
```typescript
private static handleCliError(error: CliError, context: string, logger: Logger): void {
    logger.error(`CLI error in ${context}:`, error);
    
    if (error.message.includes('not found')) {
        vscode.window.showErrorMessage(
            'Moderne CLI not found. Please configure the CLI path in settings.',
            'Open Settings',
            'Download CLI'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'moderne.cli');
            } else if (selection === 'Download CLI') {
                vscode.env.openExternal(vscode.Uri.parse('https://docs.moderne.io/cli/installation'));
            }
        });
    } else if (error.exitCode === 1) {
        vscode.window.showWarningMessage(
            'CLI operation failed. Check the output panel for details.',
            'View Output'
        ).then(selection => {
            if (selection === 'View Output') {
                logger.show();
            }
        });
    } else {
        vscode.window.showErrorMessage(`CLI Error: ${error.message}`);
    }
}
```

#### Progress and Cancellation
```typescript
async refreshRepositories(): Promise<void> {
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Refreshing repositories...',
            cancellable: true
        }, async (progress, token) => {
            if (token.isCancellationRequested) {
                throw new Error('Operation cancelled by user');
            }
            
            progress.report({ increment: 0, message: 'Loading repository data...' });
            await this.loadRepositoryData();
            
            progress.report({ increment: 100, message: 'Complete' });
        });
    } catch (error) {
        if (error.message === 'Operation cancelled by user') {
            // Silent cancellation
            return;
        }
        
        ErrorHandler.handle(error, 'Repository refresh', this.logger);
        throw error;
    }
}
```

## Alternatives Considered

### 1. Global Error Handler
**Rejected**: Would make error context less specific and harder to provide appropriate user actions.

### 2. Try-Catch Everywhere
**Rejected**: Would lead to inconsistent error handling and poor user experience.

### 3. Silent Error Swallowing
**Rejected**: Would hide problems and make debugging impossible.

### 4. Technical Error Messages Only
**Rejected**: Would provide poor user experience for non-technical users.

## Consequences

### Positive
- ✅ Consistent error handling across the entire extension
- ✅ User-friendly error messages with actionable guidance
- ✅ Comprehensive logging for debugging and support
- ✅ Graceful degradation for non-critical features
- ✅ Custom error types enable specific handling strategies

### Negative
- ❌ Additional complexity in error handling code
- ❌ Need to maintain error message translations
- ❌ Risk of over-engineering error scenarios

### Mitigation Strategies

#### Error Message Consistency
```typescript
const ERROR_MESSAGES = {
    CLI_NOT_FOUND: 'Moderne CLI not found. Please check your CLI configuration.',
    LICENSE_INVALID: 'No valid Moderne license found. Please check your license configuration.',
    REPOSITORY_ACCESS_FAILED: 'Failed to access repository. Check your permissions.'
} as const;
```

#### Error Testing
```typescript
// Unit test error scenarios
describe('CliService Error Handling', () => {
    it('should throw CliError for missing CLI', async () => {
        // Mock CLI not found scenario
        await expect(cliService.checkVersion()).rejects.toThrow(CliError);
    });
});
```

## Error Handling Patterns

### 1. Command Execution Errors
```typescript
async execute(): Promise<void> {
    try {
        await this.performOperation();
        vscode.window.showInformationMessage('Operation completed successfully');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.services.logger.error('Command execution failed', error);
        vscode.window.showErrorMessage(`Operation failed: ${message}`);
    }
}
```

### 2. Configuration Validation Errors
```typescript
validateConfiguration(): string[] {
    const errors: string[] = [];
    const config = this.getConfiguration();
    
    if (config.cli.jarPath && config.cli.useSystemPath) {
        errors.push('Cannot use both system PATH and JAR file for CLI');
    }
    
    return errors;
}
```

### 3. Network and Timeout Errors
```typescript
async fetchData(): Promise<Data> {
    try {
        return await this.networkOperation();
    } catch (error) {
        if (error.code === 'ETIMEDOUT') {
            throw new Error('Network operation timed out. Please check your connection.');
        }
        throw error;
    }
}
```

## Implementation Status

- ✅ Custom error types defined (CliError, ConfigurationError, LicenseError)
- ✅ ErrorHandler class with category-specific handling
- ✅ User-friendly error messages with action buttons
- ✅ Comprehensive logging integration
- ✅ Graceful degradation for non-critical features
- ✅ Progress reporting with cancellation support
- ✅ Extension activation error boundaries

## Error Categories and Responses

| Error Type | User Action | Technical Action | Degradation |
|------------|-------------|------------------|-------------|
| CLI Not Found | Show settings link | Log technical details | Continue with warnings |
| License Invalid | Show license help | Log license status | Disable CLI features |
| Network Timeout | Retry option | Log network details | Use cached data |
| Configuration Invalid | Show validation errors | Log config state | Use defaults |
| Parse Error | Show error context | Log raw data | Skip invalid items |

## Related Decisions
- [ADR-001: Service Layer Architecture](./001-service-layer-architecture.md)
- [ADR-002: CLI Integration Strategy](./002-cli-integration-strategy.md)
- [ADR-003: Configuration Management](./003-configuration-management.md)

---

This error handling strategy ensures a robust, user-friendly extension that gracefully handles failures while providing excellent debugging capabilities for development and support.