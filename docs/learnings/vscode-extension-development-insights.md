# VSCode Extension Development - Technical Insights

**Date:** July 23, 2025  
**Context:** Moderne VSCode Extension Development  
**Author:** Development Team

## 🔧 VSCode Extension API Insights

### Extension Lifecycle Management

#### Activation Patterns
**Key Learning**: VSCode extensions should activate lazily based on specific triggers rather than on startup.

```json
{
  "activationEvents": [
    "onLanguage:java",
    "onCommand:moderne.setActiveRecipe", 
    "onView:moderneExplorer"
  ]
}
```

**Benefits**:
- Faster VSCode startup times
- Reduced memory footprint
- Better user experience

#### Deactivation Cleanup
**Critical Pattern**: Always implement proper resource cleanup in `deactivate()`.

```typescript
export function deactivate(): void {
    // Dispose of output channels
    if (logger) {
        logger.dispose();
    }
    
    // Clean up event listeners
    // Dispose of status bar items
    // Cancel ongoing operations
}
```

### Command System Architecture

#### Command Registration Pattern
**Discovery**: Commands must be both registered programmatically AND declared in package.json.

```typescript
// 1. Register the command handler
const disposable = vscode.commands.registerCommand(
    'moderne.test',
    this.execute.bind(this)
);
context.subscriptions.push(disposable);

// 2. Declare in package.json contributes.commands
```

#### Context Menu Integration
**Learning**: Context menu visibility is controlled by `when` clauses in package.json.

```json
{
  "menus": {
    "editor/context": [
      {
        "command": "moderne.setActiveRecipe",
        "when": "editorLangId == java && resourceExtname == .java",
        "group": "moderne@1"
      }
    ]
  }
}
```

### Tree View Implementation

#### TreeDataProvider Pattern
**Insight**: Tree views require implementing `TreeDataProvider` interface with proper refresh mechanisms.

```typescript
export class ModerneTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}
```

#### Hierarchical Data Structure
**Pattern**: Use inheritance for different tree item types with consistent interfaces.

```typescript
abstract class TreeItem extends vscode.TreeItem {
    constructor(label: string, collapsibleState?: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
    }
}

class RepositoryTreeItem extends TreeItem {
    constructor(public readonly repository: Repository) {
        super(repository.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'repository';
    }
}
```

## 🏗️ Architecture Patterns

### Service Layer Design

#### Dependency Injection Pattern
**Implementation**: Use a service registry for clean dependency management.

```typescript
export interface ServiceRegistry {
    config: ConfigService;
    cli: CliService;
    repository: RepositoryService;
    recipe: RecipeService;
    logger: Logger;
}
```

**Benefits**:
- Easy testing with mocks
- Clear dependency relationships
- Type-safe service access

#### Event-Driven Communication
**Pattern**: Services communicate through events rather than direct coupling.

```typescript
class RepositoryService {
    private _onRepositoriesChanged = new vscode.EventEmitter<Repository[]>();
    public readonly onRepositoriesChanged = this._onRepositoriesChanged.event;
    
    private notifyRepositoriesChanged(): void {
        this._onRepositoriesChanged.fire(this.repositories);
    }
}
```

### Configuration Management

#### Centralized Configuration Service
**Pattern**: Single service manages all extension configuration with validation.

```typescript
export class ConfigService {
    getConfiguration(): ModerneConfiguration {
        const config = vscode.workspace.getConfiguration('moderne');
        return {
            enabled: config.get<boolean>('enabled', true),
            cli: {
                useSystemPath: config.get<boolean>('cli.useSystemPath', true),
                path: config.get<string>('cli.path', 'mod')
            }
        };
    }
    
    validateConfiguration(): string[] {
        // Return validation errors
    }
}
```

#### State Management
**Learning**: Distinguish between global state (user preferences) and workspace state (project-specific).

```typescript
// Global state - persists across workspaces
getGlobalState<T>(key: string, defaultValue?: T): T | undefined {
    return this.context.globalState.get(key, defaultValue);
}

// Workspace state - project-specific
getWorkspaceState<T>(key: string, defaultValue?: T): T | undefined {
    return this.context.workspaceState.get(key, defaultValue);
}
```

## 🔄 Async Operations and Error Handling

### CLI Integration Patterns

#### Robust Command Execution
**Learning**: CLI operations require comprehensive error handling and timeout management.

```typescript
async executeCommand(args: string[], options?: {
    cwd?: string;
    timeout?: number;
}): Promise<CliResult> {
    return new Promise((resolve) => {
        const childProcess = cp.spawn(command, args, {
            timeout: options?.timeout || 30000,
            shell: true
        });
        
        // Handle all possible outcomes:
        // - success with JSON response
        // - success with plain text
        // - failure with error code
        // - timeout
        // - process error
    });
}
```

#### Non-Blocking Initialization
**Critical Pattern**: Non-critical initialization should not block extension activation.

```typescript
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        // Critical initialization (must succeed)
        const services = await initializeCoreServices(context);
        registerCommands(context, services);
        
        // Non-critical initialization (can fail gracefully)
        initializeStatusBar(services).catch(error => {
            logger.warn('Status bar initialization failed', error);
        });
        
        performInitialValidation(services).catch(error => {
            logger.warn('Initial validation failed', error);
        });
        
    } catch (error) {
        // Only critical errors should fail activation
        vscode.window.showErrorMessage(`Extension activation failed: ${error.message}`);
    }
}
```

### Progress Reporting

#### User Feedback Pattern
**Implementation**: Use VSCode's progress API for long-running operations.

```typescript
await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Refreshing repositories...',
    cancellable: false
}, async (progress) => {
    progress.report({ increment: 0, message: 'Loading repository data...' });
    await this.services.repository.refreshRepositories();
    progress.report({ increment: 100, message: 'Complete' });
});
```

## 🐛 Common Issues and Solutions

### Circular Import Dependencies

#### Problem Pattern
```typescript
// ❌ This creates circular dependency
// commands/index.ts
export { Command } from './baseCommand';
import { SetActiveRecipeCommand } from './setActiveRecipeCommand';

// commands/setActiveRecipeCommand.ts  
import { Command } from './index';
```

#### Solution Pattern
```typescript
// ✅ Extract base classes to separate files
// commands/baseCommand.ts
export abstract class Command { ... }

// commands/index.ts
import { SetActiveRecipeCommand } from './setActiveRecipeCommand';

// commands/setActiveRecipeCommand.ts
import { Command } from './baseCommand';
```

### Extension Activation Failures

#### Debugging Approach
1. **Add comprehensive logging** at each activation step
2. **Implement error boundaries** for non-critical features
3. **Use Extension Host console** for debugging
4. **Check Output panel** for extension-specific logs

```typescript
logger.info('Starting extension activation...');
logger.info('Services initialized');
logger.info('Commands registered');
logger.info('Extension activated successfully');
```

### TypeScript Configuration Issues

#### Module Resolution
**Learning**: CommonJS works better than ES modules for VSCode extensions.

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "moduleResolution": "node"
  }
}
```

#### Strict Type Checking
**Benefit**: Catches runtime errors during development.

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true
  }
}
```

## 🧪 Testing Strategies

### Development Testing Workflow

#### F5 Debug Testing
**Primary Method**: Extension Development Host provides real VSCode environment.

1. Press F5 to launch Extension Development Host
2. Set breakpoints in extension code  
3. Test real user workflows
4. Monitor Extension Host console for errors

#### Unit Testing Setup
**Framework**: Mocha with VSCode test runner.

```typescript
// src/test/suite/extension.test.ts
suite('Extension Test Suite', () => {
    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('moderne.vscode-moderne');
        await extension!.activate();
        assert.strictEqual(extension!.isActive, true);
    });
});
```

### Manual Testing Checklist

#### Extension Activation
- [ ] Extension loads without errors
- [ ] Commands appear in Command Palette
- [ ] Tree view displays correctly  
- [ ] Status bar integration works

#### Command Execution
- [ ] All commands execute without "not found" errors
- [ ] Error messages are user-friendly
- [ ] Progress reporting works for long operations
- [ ] Context menus appear on appropriate files

#### Configuration
- [ ] Settings are validated correctly
- [ ] Changes take effect immediately
- [ ] Invalid configurations show helpful errors

## 🚀 Performance Considerations

### Extension Startup Time

#### Lazy Loading Pattern
**Principle**: Only load what's needed for initial activation.

```typescript
// ✅ Lazy load heavy dependencies
private async getHeavyService(): Promise<HeavyService> {
    if (!this.heavyService) {
        const { HeavyService } = await import('./heavyService');
        this.heavyService = new HeavyService();
    }
    return this.heavyService;
}
```

#### Caching Strategy
**Pattern**: Cache expensive operations with proper invalidation.

```typescript
class RepositoryService {
    private repositoryCache: Repository[] | null = null;
    private cacheTimestamp: number = 0;
    
    async getRepositories(): Promise<Repository[]> {
        const now = Date.now();
        if (this.repositoryCache && (now - this.cacheTimestamp) < 30000) {
            return this.repositoryCache;
        }
        
        this.repositoryCache = await this.fetchRepositories();
        this.cacheTimestamp = now;
        return this.repositoryCache;
    }
}
```

### Memory Management

#### Resource Disposal
**Critical**: Always dispose of VSCode resources.

```typescript
export function deactivate(): void {
    // Dispose output channels
    logger?.dispose();
    
    // Cancel ongoing operations
    activeOperations.forEach(op => op.cancel());
    
    // Clear caches
    repositoryCache.clear();
}
```

## 📚 Best Practices Summary

### Development Workflow
1. **Use F5 debugging** for primary testing
2. **Implement comprehensive logging** for troubleshooting
3. **Handle errors gracefully** with user-friendly messages
4. **Use TypeScript strict mode** to catch errors early

### Architecture Principles
1. **Service layer separation** for clean architecture
2. **Event-driven communication** between components
3. **Dependency injection** for testable code
4. **Non-blocking initialization** for better UX

### Extension Integration
1. **Proper activation events** for performance
2. **Context-sensitive commands** for better UX
3. **Progress reporting** for long operations
4. **Resource cleanup** in deactivate()

---

These insights form the foundation for successful VSCode extension development and will guide future phases of the Moderne extension implementation.