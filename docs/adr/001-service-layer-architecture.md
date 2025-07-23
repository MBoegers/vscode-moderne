# ADR-001: Service Layer Architecture

**Date:** 2025-07-23  
**Status:** Accepted  
**Context:** VSCode Moderne Extension - Phase 1 Foundation

## Context

The VSCode Moderne Extension requires a clean architecture that separates concerns, enables testing, and provides maintainable code organization. We need to decide on the overall architectural pattern for the extension.

## Decision

We will implement a **Service Layer Architecture** with dependency injection using a service registry pattern.

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    VSCode Extension API                     │
├─────────────────────────────────────────────────────────────┤
│  UI Layer (Commands, Tree Views, Context Menus, Dialogs)   │
├─────────────────────────────────────────────────────────────┤
│        Service Layer (CLI, Repository, Recipe Services)     │
├─────────────────────────────────────────────────────────────┤
│            Data Layer (Models, Configuration, Cache)        │
├─────────────────────────────────────────────────────────────┤
│              Utilities (Parsers, Generators, Utils)         │
└─────────────────────────────────────────────────────────────┘
```

### Service Registry Implementation

```typescript
export interface ServiceRegistry {
    config: ConfigService;
    cli: CliService;
    repository: RepositoryService;
    recipe: RecipeService;
    logger: Logger;
}
```

### Core Services

1. **ConfigService**: Centralized configuration management
2. **CliService**: Moderne CLI integration and command execution
3. **RepositoryService**: Repository data management and caching
4. **RecipeService**: Recipe detection, parsing, and management
5. **Logger**: Structured logging with configurable levels

## Rationale

### Benefits

1. **Separation of Concerns**: Each service has a single responsibility
2. **Testability**: Services can be easily mocked and unit tested
3. **Maintainability**: Clear boundaries make code easier to understand and modify
4. **Extensibility**: New services can be added without affecting existing code
5. **Type Safety**: TypeScript interfaces provide compile-time verification
6. **Dependency Management**: Clear dependency relationships through injection

### Implementation Details

#### Service Initialization
```typescript
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize services with proper dependency order
    const configService = new ConfigService(context);
    const cliService = new CliService(configService, logger);
    const repositoryService = new RepositoryService(cliService, logger);
    const recipeService = new RecipeService(cliService, configService, logger);
    
    const services: ServiceRegistry = {
        config: configService,
        cli: cliService,
        repository: repositoryService,
        recipe: recipeService,
        logger: logger
    };
}
```

#### Event-Driven Communication
```typescript
class RepositoryService {
    private _onRepositoriesChanged = new vscode.EventEmitter<Repository[]>();
    public readonly onRepositoriesChanged = this._onRepositoriesChanged.event;
}
```

## Alternatives Considered

### 1. Monolithic Architecture
**Rejected**: Would create tightly coupled code that's difficult to test and maintain.

### 2. Module-Based Architecture
**Rejected**: TypeScript modules don't provide sufficient dependency injection capabilities.

### 3. Plugin Architecture
**Rejected**: Overkill for the extension's scope and would add unnecessary complexity.

## Consequences

### Positive
- ✅ Clean separation of concerns
- ✅ Easy unit testing with mocked dependencies
- ✅ Clear data flow and dependency relationships
- ✅ Extensible architecture for future features
- ✅ Type-safe service interactions

### Negative
- ❌ Initial setup complexity
- ❌ More boilerplate code for service definitions
- ❌ Potential performance overhead from service abstraction

### Mitigation Strategies
- Use TypeScript interfaces to minimize runtime overhead
- Implement lazy loading for heavy services
- Cache expensive operations at the service level

## Implementation Status

- ✅ Service registry interface defined
- ✅ All core services implemented
- ✅ Dependency injection working in activation
- ✅ Event-driven communication established
- ✅ Services integrated with VSCode API

## Related Decisions
- [ADR-002: CLI Integration Strategy](./002-cli-integration-strategy.md)
- [ADR-003: Configuration Management](./003-configuration-management.md)
- [ADR-004: Error Handling Strategy](./004-error-handling-strategy.md)

---

This architectural decision provides a solid foundation for the VSCode Moderne Extension that will scale well as we add more features in future phases.