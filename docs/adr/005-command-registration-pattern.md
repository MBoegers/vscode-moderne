# ADR-005: Command Registration Pattern

**Date:** 2025-07-23  
**Status:** Accepted  
**Context:** VSCode Moderne Extension - Command Architecture and Registration

## Context

The VSCode Moderne Extension needs to register multiple commands with the VSCode command system. We encountered a critical issue with circular imports that prevented proper command registration and extension activation. We need a robust pattern for command organization and registration.

## Decision

We will implement a **base command pattern with separate base class** to avoid circular imports, combined with a centralized command registry that handles all command registration during extension activation.

### Command Architecture

```
src/commands/
├── baseCommand.ts          # Abstract base class
├── index.ts               # Command registration coordinator
├── setActiveRecipeCommand.ts    # Individual command implementations
├── findUsagesCommand.ts
├── createRecipeCommand.ts
├── refreshRepositoriesCommand.ts
├── checkCliStatusCommand.ts
└── testCommand.ts
```

### Base Command Pattern

```typescript
// baseCommand.ts
export abstract class Command {
    protected services: ServiceRegistry;

    constructor(services: ServiceRegistry) {
        this.services = services;
    }

    abstract register(context: vscode.ExtensionContext): void;
    abstract execute(...args: any[]): Promise<void>;
}
```

### Command Registration Pattern

```typescript
// index.ts
export function registerCommands(
    context: vscode.ExtensionContext,
    services: ServiceRegistry
): void {
    const commands = [
        new TestCommand(services),
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
```

### Individual Command Implementation

```typescript
// setActiveRecipeCommand.ts
import { Command } from './baseCommand';

export class SetActiveRecipeCommand extends Command {
    register(context: vscode.ExtensionContext): void {
        const disposable = vscode.commands.registerCommand(
            'moderne.setActiveRecipe',
            this.execute.bind(this)
        );
        context.subscriptions.push(disposable);
    }

    async execute(uri?: vscode.Uri): Promise<void> {
        // Command implementation
    }
}
```

## Rationale

### Problem: Circular Import Dependency

The original architecture had a circular dependency:

```
❌ Problematic Structure:
commands/index.ts → exports Command class + imports all command files
setActiveRecipeCommand.ts → imports Command from index.ts
index.ts → imports setActiveRecipeCommand.ts
```

This resulted in the error:
```
TypeError: Class extends value undefined is not a constructor or null
```

### Solution: Separate Base Class

```
✅ Fixed Structure:
commands/baseCommand.ts → exports Command class
commands/index.ts → imports all command files (no exports)
setActiveRecipeCommand.ts → imports Command from baseCommand.ts
```

### Design Principles

1. **Separation of Concerns**: Each command handles one specific functionality
2. **Dependency Injection**: Commands receive services through constructor
3. **Consistent Interface**: All commands implement the same base pattern
4. **Centralized Registration**: Single point of command registration
5. **Type Safety**: TypeScript interfaces ensure proper implementation

### Benefits

1. **No Circular Dependencies**: Base class is separate from registration logic
2. **Easy Testing**: Commands can be unit tested with mocked services
3. **Consistent Error Handling**: Base class can provide common error handling
4. **Easy Extension**: Adding new commands follows the same pattern
5. **Clear Dependencies**: Service dependencies are explicit

## Implementation Details

### Package.json Command Contributions

```json
{
  "contributes": {
    "commands": [
      {
        "command": "moderne.setActiveRecipe",
        "title": "Set Active Recipe",
        "category": "Moderne",
        "icon": "$(play)"
      },
      {
        "command": "moderne.findUsagesAllRepos",
        "title": "Find Usages on All Repos",
        "category": "Moderne",
        "icon": "$(search)"
      }
    ]
  }
}
```

### Context Menu Integration

```json
{
  "menus": {
    "editor/context": [
      {
        "command": "moderne.setActiveRecipe",
        "when": "editorLangId == java && resourceExtname == .java",
        "group": "moderne@1"
      },
      {
        "command": "moderne.findUsagesAllRepos",
        "when": "editorHasSelection",
        "group": "moderne@2"
      }
    ]
  }
}
```

### Command Palette Integration

```json
{
  "menus": {
    "commandPalette": [
      {
        "command": "moderne.setActiveRecipe",
        "when": "editorLangId == java"
      },
      {
        "command": "moderne.findUsagesAllRepos",
        "when": "editorHasSelection"
      }
    ]
  }
}
```

### Command Lifecycle

1. **Extension Activation**: `registerCommands()` called during activation
2. **Command Registration**: Each command registers with VSCode
3. **Context Subscription**: Command disposables added to context
4. **Command Execution**: VSCode routes commands to registered handlers
5. **Extension Deactivation**: Commands automatically disposed

### Error Handling in Commands

```typescript
export abstract class Command {
    protected async safeExecute(operation: () => Promise<void>): Promise<void> {
        try {
            await operation();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error(`Command ${this.constructor.name} failed`, error);
            vscode.window.showErrorMessage(`Operation failed: ${message}`);
        }
    }
}

// Usage in concrete commands
async execute(): Promise<void> {
    await this.safeExecute(async () => {
        // Command logic here
    });
}
```

## Alternatives Considered

### 1. Functional Command Registration
```typescript
// Rejected approach
const commands = {
    'moderne.setActiveRecipe': async (uri?: vscode.Uri) => {
        // Implementation
    }
};
```
**Rejected**: Lacks structure for dependency injection and testing.

### 2. Command Classes with Static Methods
```typescript
// Rejected approach
export class SetActiveRecipeCommand {
    static register(context: vscode.ExtensionContext): void { /* ... */ }
    static async execute(): Promise<void> { /* ... */ }
}
```
**Rejected**: Makes dependency injection and testing more difficult.

### 3. Single Command Handler Class
```typescript
// Rejected approach
export class CommandHandler {
    async setActiveRecipe(): Promise<void> { /* ... */ }
    async findUsages(): Promise<void> { /* ... */ }
}
```
**Rejected**: Violates single responsibility principle and makes testing harder.

## Consequences

### Positive
- ✅ No circular import dependencies
- ✅ Clean separation of command logic
- ✅ Easy unit testing with dependency injection
- ✅ Consistent command interface across the extension
- ✅ Type-safe command implementations
- ✅ Centralized command registration and management

### Negative
- ❌ Additional abstraction layer
- ❌ More files to maintain
- ❌ Requires understanding of the base command pattern

### Mitigation Strategies

#### Command Template
Create a template for new commands to ensure consistency:

```typescript
// Template: newCommand.ts
import * as vscode from 'vscode';
import { Command } from './baseCommand';

export class NewCommand extends Command {
    register(context: vscode.ExtensionContext): void {
        const disposable = vscode.commands.registerCommand(
            'moderne.newCommand',
            this.execute.bind(this)
        );
        context.subscriptions.push(disposable);
    }

    async execute(): Promise<void> {
        try {
            // Command implementation
            this.services.logger.info('New command executed');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('New command failed', error);
            vscode.window.showErrorMessage(`Command failed: ${message}`);
        }
    }
}
```

#### Documentation
Maintain clear documentation of the command registration pattern for future developers.

## Command Categories

### 1. Recipe Management Commands
- `moderne.setActiveRecipe`: Set active recipe from current file
- `moderne.createRecipe`: Generate OpenRewrite recipe from code selection

### 2. Repository Management Commands
- `moderne.refreshRepositories`: Refresh repository list from configuration
- `moderne.findUsagesAllRepos`: Multi-repository code search

### 3. Utility Commands
- `moderne.checkCliStatus`: Display CLI status and configuration
- `moderne.test`: Test extension functionality (development)

## Testing Strategy

### Unit Testing Commands
```typescript
describe('SetActiveRecipeCommand', () => {
    let command: SetActiveRecipeCommand;
    let mockServices: ServiceRegistry;

    beforeEach(() => {
        mockServices = {
            recipe: {
                setActiveRecipe: jest.fn()
            }
        } as any;
        command = new SetActiveRecipeCommand(mockServices);
    });

    it('should set active recipe when executed', async () => {
        await command.execute();
        expect(mockServices.recipe.setActiveRecipe).toHaveBeenCalled();
    });
});
```

### Integration Testing
- Test command registration during extension activation
- Verify commands appear in Command Palette
- Test context menu integration

## Implementation Status

- ✅ Base Command class extracted to separate file
- ✅ All commands updated to use separate base class
- ✅ Circular import dependency resolved
- ✅ Command registration working properly
- ✅ Extension activation successful
- ✅ All commands appear in Command Palette
- ✅ Context menu integration functional
- ✅ Error handling implemented in commands

## Future Enhancements

### 1. Command Categories
Organize commands into logical categories for better maintainability:

```typescript
const recipeCommands = [
    new SetActiveRecipeCommand(services),
    new CreateRecipeCommand(services)
];

const repositoryCommands = [
    new RefreshRepositoriesCommand(services),
    new FindUsagesCommand(services)
];
```

### 2. Command Middleware
Add middleware support for common functionality:

```typescript
abstract class Command {
    protected middleware: CommandMiddleware[] = [];
    
    async execute(...args: any[]): Promise<void> {
        for (const middleware of this.middleware) {
            await middleware.beforeExecute(this, args);
        }
        
        await this.executeImpl(...args);
        
        for (const middleware of this.middleware) {
            await middleware.afterExecute(this, args);
        }
    }
    
    abstract executeImpl(...args: any[]): Promise<void>;
}
```

### 3. Command Validation
Add parameter validation for commands:

```typescript
abstract class Command {
    protected validate(...args: any[]): void {
        // Override in subclasses for parameter validation
    }
}
```

## Related Decisions
- [ADR-001: Service Layer Architecture](./001-service-layer-architecture.md)
- [ADR-006: Testing Strategy](./006-testing-strategy.md)

---

This command registration pattern provides a robust, maintainable foundation for all VSCode commands while avoiding the circular dependency issues that prevented proper extension activation.