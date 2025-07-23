# ADR-002: CLI Integration Strategy

**Date:** 2025-07-23  
**Status:** Accepted  
**Context:** VSCode Moderne Extension - Moderne CLI Integration

## Context

The VSCode Moderne Extension needs to integrate with the Moderne CLI to execute commands, validate licenses, and manage repositories. We need to decide on the approach for CLI integration that provides reliability, error handling, and good user experience.

## Decision

We will implement a **comprehensive CLI service** that abstracts all Moderne CLI interactions with robust error handling, timeout management, and response parsing.

### CLI Service Architecture

```typescript
export class CliService {
    async executeCommand(args: string[], options?: {
        cwd?: string;
        timeout?: number;
        input?: string;
    }): Promise<CliResult> {
        // Comprehensive command execution with error handling
    }
    
    async checkVersion(): Promise<string>
    async validateLicense(): Promise<boolean>
    async listRepositories(path: string): Promise<Repository[]>
    async runActiveRecipe(path: string, options?: RecipeRunOptions): Promise<CliResult>
}
```

### Key Features

1. **Robust Command Execution**: Handles all possible CLI outcomes
2. **Timeout Management**: Prevents hanging operations
3. **Response Parsing**: Handles both JSON and plain text responses
4. **Error Handling**: Comprehensive error classification and user-friendly messages
5. **Configuration Flexibility**: Supports multiple CLI installation methods

## Rationale

### CLI Execution Challenges

1. **Exit Code Handling**: Node.js child process exit codes can be `null`
2. **Response Format Variability**: CLI returns both JSON and plain text
3. **Timeout Requirements**: Some operations may hang indefinitely
4. **Error Message Quality**: Raw CLI errors are often not user-friendly

### Implementation Details

#### Command Execution Pattern
```typescript
async executeCommand(args: string[], options?: {
    cwd?: string;
    timeout?: number;
    input?: string;
}): Promise<CliResult> {
    return new Promise((resolve) => {
        const childProcess = cp.spawn(command, args, {
            cwd: options?.cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
            timeout: options?.timeout || 30000,
            shell: true
        });

        let stdout = '';
        let stderr = '';

        childProcess.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        childProcess.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        childProcess.on('close', (code) => {
            const exitCode = code ?? -1; // Handle null exit codes
            
            if (exitCode === 0) {
                try {
                    // Try JSON parsing first
                    const data = stdout.trim() ? JSON.parse(stdout) : null;
                    resolve({ success: true, data, exitCode, stdout, stderr });
                } catch (error) {
                    // Fall back to plain text
                    resolve({ success: true, data: stdout.trim(), exitCode, stdout, stderr });
                }
            } else {
                const errorMessage = stderr || stdout || `Command failed with exit code ${exitCode}`;
                resolve({ success: false, error: errorMessage, exitCode, stdout, stderr });
            }
        });

        childProcess.on('error', (error) => {
            resolve({ success: false, error: error.message, stderr: error.message });
        });
    });
}
```

#### Configuration Flexibility
```typescript
getCliPath(): string {
    const config = this.configService.getConfiguration();
    
    if (config.cli.jarPath) {
        return `java -jar "${config.cli.jarPath}"`;
    }
    
    if (config.cli.useSystemPath) {
        return 'mod';
    }
    
    return config.cli.path;
}
```

#### Error Classification
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
```

## Alternatives Considered

### 1. Direct CLI Execution in Commands
**Rejected**: Would duplicate CLI logic across multiple commands and make error handling inconsistent.

### 2. Shell Script Wrappers
**Rejected**: Would add platform-specific complexity and make debugging harder.

### 3. REST API Integration
**Rejected**: Moderne CLI doesn't provide a REST API, and we need to work with the existing CLI tool.

### 4. Synchronous CLI Execution
**Rejected**: Would block the VSCode UI during CLI operations.

## Consequences

### Positive
- ✅ Consistent CLI interaction across all features
- ✅ Robust error handling and timeout management
- ✅ Support for multiple CLI installation methods
- ✅ Comprehensive logging and debugging capabilities
- ✅ Type-safe CLI responses with proper parsing

### Negative
- ❌ Dependency on external CLI tool
- ❌ Potential performance overhead from subprocess execution
- ❌ Platform-specific considerations for CLI execution

### Mitigation Strategies

#### CLI Availability Checking
```typescript
async isAvailable(): Promise<boolean> {
    try {
        await this.checkVersion();
        return true;
    } catch {
        return false;
    }
}
```

#### Graceful Degradation
```typescript
// Non-blocking CLI operations during activation
performInitialValidation(services).catch(error => {
    logger.warn('Initial CLI validation failed', error);
    // Extension continues to work with limited functionality
});
```

#### User-Friendly Error Messages
```typescript
if (!isAvailable) {
    vscode.window.showErrorMessage(
        'Moderne CLI not found. Please check your configuration.',
        'Open Settings'
    ).then(selection => {
        if (selection === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'moderne.cli');
        }
    });
}
```

## Implementation Status

- ✅ CLI service implemented with comprehensive error handling
- ✅ Support for system PATH, custom path, and JAR execution
- ✅ JSON and plain text response parsing
- ✅ Timeout management and cancellation
- ✅ License validation and version checking
- ✅ Repository listing and recipe execution
- ✅ User-friendly error messages and configuration guidance

## CLI Commands Supported

1. **Version Checking**: `mod --version`
2. **License Validation**: `mod config license show --json`
3. **Organization Listing**: `mod config moderne organizations show --json`
4. **Repository Discovery**: `mod list <path> --json`
5. **LST Building**: `mod build <path>`
6. **Recipe Execution**: `mod run <path> --active-recipe [--jvm-debug]`

## Related Decisions
- [ADR-001: Service Layer Architecture](./001-service-layer-architecture.md)
- [ADR-003: Configuration Management](./003-configuration-management.md)
- [ADR-004: Error Handling Strategy](./004-error-handling-strategy.md)

---

This CLI integration strategy provides a robust foundation for all Moderne CLI interactions while maintaining good user experience and error handling.