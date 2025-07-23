# ADR-003: Configuration Management

**Date:** 2025-07-23  
**Status:** Accepted  
**Context:** VSCode Moderne Extension - Settings and Configuration

## Context

The VSCode Moderne Extension requires comprehensive configuration management for CLI settings, multi-repository configurations, recipe preferences, and logging levels. We need a centralized approach that provides validation, type safety, and seamless integration with VSCode's settings system.

## Decision

We will implement a **centralized ConfigService** that manages all extension configuration with type-safe interfaces, automatic validation, and integration with VSCode's configuration change events.

### Configuration Architecture

```typescript
export interface ModerneConfiguration {
    enabled: boolean;
    cli: {
        useSystemPath: boolean;
        path: string;
        jarPath?: string;
    };
    multiRepos: {
        localPaths: string[];
        organizations: MultiRepoConfig[];
    };
    recipes: {
        defaultType: 'refaster' | 'visitor' | 'yaml';
        templatePath?: string;
    };
    logging: {
        level: 'error' | 'warn' | 'info' | 'debug';
    };
}
```

### ConfigService Implementation

```typescript
export class ConfigService {
    private context: vscode.ExtensionContext;
    private _onDidChangeConfiguration = new vscode.EventEmitter<void>();
    public readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;

    getConfiguration(): ModerneConfiguration { /* ... */ }
    validateConfiguration(): string[] { /* ... */ }
    getCliPath(): string { /* ... */ }
    updateConfiguration(section: string, value: any): Promise<void> { /* ... */ }
    
    // State management
    getGlobalState<T>(key: string, defaultValue?: T): T | undefined { /* ... */ }
    setGlobalState<T>(key: string, value: T): Promise<void> { /* ... */ }
    getWorkspaceState<T>(key: string, defaultValue?: T): T | undefined { /* ... */ }
    setWorkspaceState<T>(key: string, value: T): Promise<void> { /* ... */ }
}
```

## Rationale

### Configuration Requirements

1. **Type Safety**: Prevent configuration errors through TypeScript interfaces
2. **Validation**: Ensure configuration values are valid before use
3. **Reactivity**: Respond to configuration changes in real-time
4. **State Management**: Handle both global and workspace-specific settings
5. **Default Values**: Provide sensible defaults for all settings

### Key Design Decisions

#### 1. Centralized Configuration Access
**Rationale**: Single source of truth prevents configuration inconsistencies across the extension.

#### 2. Type-Safe Interface
**Rationale**: Compile-time type checking prevents configuration-related bugs.

#### 3. Configuration Validation
**Rationale**: Prevents runtime errors from invalid configuration combinations.

#### 4. Event-Driven Updates
**Rationale**: Allows components to react to configuration changes automatically.

### Implementation Details

#### Package.json Configuration Schema
```json
{
  "contributes": {
    "configuration": {
      "type": "object",
      "title": "Moderne",
      "properties": {
        "moderne.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable/disable the Moderne extension"
        },
        "moderne.cli.useSystemPath": {
          "type": "boolean",
          "default": true,
          "description": "Use Moderne CLI from system PATH"
        },
        "moderne.cli.path": {
          "type": "string",
          "default": "mod",
          "description": "Path to the Moderne CLI executable"
        },
        "moderne.multiRepos.localPaths": {
          "type": "array",
          "items": { "type": "string" },
          "default": [],
          "description": "Array of local multi-repo paths"
        }
      }
    }
  }
}
```

#### Configuration Change Handling
```typescript
constructor(context: vscode.ExtensionContext) {
    this.context = context;

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('moderne')) {
            this._onDidChangeConfiguration.fire();
        }
    });
}
```

#### Validation Implementation
```typescript
validateConfiguration(): string[] {
    const errors: string[] = [];
    const config = this.getConfiguration();

    // Validate CLI configuration
    if (config.cli.jarPath && config.cli.useSystemPath) {
        errors.push('Cannot use both system PATH and JAR file for CLI. Please choose one.');
    }

    if (!config.cli.useSystemPath && !config.cli.path && !config.cli.jarPath) {
        errors.push('CLI path must be specified when not using system PATH.');
    }

    // Validate multi-repo configurations
    config.multiRepos.organizations.forEach((org, index) => {
        if (!org.name || !org.id) {
            errors.push(`Organization at index ${index} must have both name and id.`);
        }
    });

    return errors;
}
```

#### State Management Separation
```typescript
// Global state - persists across workspace changes
getGlobalState<T>(key: string, defaultValue?: T): T | undefined {
    return this.context.globalState.get(key, defaultValue);
}

// Workspace state - workspace-specific
getWorkspaceState<T>(key: string, defaultValue?: T): T | undefined {
    return this.context.workspaceState.get(key, defaultValue);
}
```

## Alternatives Considered

### 1. Direct VSCode Configuration Access
**Rejected**: Would scatter configuration logic throughout the codebase and make validation difficult.

### 2. JSON Configuration Files
**Rejected**: Would bypass VSCode's built-in settings UI and require custom file management.

### 3. Environment Variables
**Rejected**: Would make configuration less discoverable and harder to manage for users.

### 4. Database Configuration Storage
**Rejected**: Overkill for extension settings and would complicate deployment.

## Consequences

### Positive
- ✅ Type-safe configuration access throughout the extension
- ✅ Centralized validation prevents configuration errors
- ✅ Automatic UI integration through VSCode settings
- ✅ Real-time configuration updates via events
- ✅ Separation of global vs workspace settings
- ✅ Easy testing with mock configurations

### Negative
- ❌ Additional abstraction layer over VSCode configuration API
- ❌ Requires maintenance of configuration schema in package.json
- ❌ Type definitions must be kept in sync with package.json

### Mitigation Strategies

#### Schema Validation
```typescript
// Ensure type definitions match package.json schema
const config = vscode.workspace.getConfiguration('moderne');
const typedConfig: ModerneConfiguration = {
    enabled: config.get<boolean>('enabled', true),
    // Explicit type checking for each property
};
```

#### Default Value Management
```typescript
// Centralized default values
const CONFIGURATION_DEFAULTS = {
    enabled: true,
    cli: {
        useSystemPath: true,
        path: 'mod'
    },
    logging: {
        level: 'info' as const
    }
} as const;
```

## Configuration Categories

### 1. CLI Configuration
- **Purpose**: Configure Moderne CLI integration
- **Settings**: Path, JAR location, system PATH usage
- **Validation**: Ensure only one CLI method is configured

### 2. Multi-Repository Configuration
- **Purpose**: Configure repository sources for the extension
- **Settings**: Local paths, organization configurations
- **Validation**: Ensure organization objects have required fields

### 3. Recipe Configuration
- **Purpose**: Configure recipe generation and management
- **Settings**: Default recipe type, template paths
- **Validation**: Ensure template paths exist if specified

### 4. Extension Configuration
- **Purpose**: Control extension behavior and logging
- **Settings**: Enable/disable extension, logging levels
- **Validation**: Ensure logging levels are valid

## Implementation Status

- ✅ ConfigService implemented with type-safe interfaces
- ✅ Configuration validation with error reporting
- ✅ Integration with VSCode configuration change events
- ✅ Global and workspace state separation
- ✅ CLI path resolution with multiple installation methods
- ✅ Default value handling for all settings
- ✅ Configuration schema defined in package.json

## Usage Examples

### Service Integration
```typescript
// In other services
class CliService {
    constructor(private configService: ConfigService) {
        // React to configuration changes
        this.configService.onDidChangeConfiguration(() => {
            this.updateCliPath();
        });
    }
}
```

### User Configuration
```json
{
  "moderne.cli.useSystemPath": false,
  "moderne.cli.path": "/usr/local/bin/mod",
  "moderne.multiRepos.localPaths": [
    "/path/to/my/repos"
  ],
  "moderne.logging.level": "debug"
}
```

## Related Decisions
- [ADR-001: Service Layer Architecture](./001-service-layer-architecture.md)
- [ADR-002: CLI Integration Strategy](./002-cli-integration-strategy.md)
- [ADR-005: State Management Strategy](./005-state-management-strategy.md)

---

This configuration management approach provides a robust, type-safe foundation for all extension settings while maintaining excellent integration with VSCode's built-in configuration system.