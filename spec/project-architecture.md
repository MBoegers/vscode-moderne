# VSCode Moderne Extension - Project Architecture

## 1. Architecture Overview

The VSCode Moderne Extension follows a **layered architecture** with clear separation of concerns, similar to the IntelliJ plugin but adapted for VSCode's extension model.

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension API                    │
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

## 2. Project Structure

```
vscode-moderne/
├── package.json                    # Extension manifest and configuration
├── README.md                       # Extension documentation
├── CHANGELOG.md                    # Version history
├── .vscode/                        # VSCode workspace settings
│   ├── launch.json                 # Debug configurations
│   ├── settings.json               # Workspace settings
│   └── tasks.json                  # Build tasks
├── src/                            # Source code
│   ├── extension.ts                # Main extension entry point
│   ├── commands/                   # Command implementations
│   │   ├── index.ts                # Command registry
│   │   ├── setActiveRecipe.ts      # Set active recipe command
│   │   ├── findUsages.ts           # Multi-repo search command
│   │   ├── createRecipe.ts         # Recipe generation command
│   │   ├── debugRecipe.ts          # Recipe debugging command
│   │   └── refreshRepositories.ts  # Repository refresh command
│   ├── providers/                  # VSCode provider implementations
│   │   ├── index.ts                # Provider registry
│   │   ├── moderneTreeProvider.ts  # Tree view data provider
│   │   ├── codeActionProvider.ts   # Code action contributions
│   │   ├── debugConfigProvider.ts  # Debug configuration provider
│   │   └── completionProvider.ts   # Recipe code completion
│   ├── services/                   # Business logic services
│   │   ├── index.ts                # Service registry
│   │   ├── cliService.ts           # Moderne CLI integration
│   │   ├── recipeService.ts        # Recipe management service
│   │   ├── repositoryService.ts    # Repository management service
│   │   ├── configService.ts        # Configuration management
│   │   └── cacheService.ts         # Data caching service
│   ├── models/                     # Data models and interfaces
│   │   ├── index.ts                # Model exports
│   │   ├── repository.ts           # Repository data models
│   │   ├── recipe.ts               # Recipe data models
│   │   ├── cliResult.ts            # CLI response models
│   │   ├── organization.ts         # Organization models
│   │   └── configuration.ts        # Configuration models
│   ├── utils/                      # Utility functions
│   │   ├── index.ts                # Utility exports
│   │   ├── javaParser.ts           # Java code analysis utilities
│   │   ├── pathUtils.ts            # File system utilities
│   │   ├── templateGenerator.ts    # Code generation utilities
│   │   ├── errorHandler.ts         # Error handling utilities
│   │   └── constants.ts            # Application constants
│   ├── types/                      # TypeScript type definitions
│   │   ├── index.ts                # Type exports
│   │   ├── vscode.d.ts             # VSCode API extensions
│   │   └── moderne.d.ts            # Moderne-specific types
│   └── resources/                  # Static resources
│       ├── icons/                  # Extension icons
│       ├── templates/              # Recipe templates
│       └── schemas/                # JSON schemas
├── test/                           # Test suites
│   ├── suite/                      # Test suite definitions
│   │   ├── extension.test.ts       # Extension activation tests
│   │   ├── commands.test.ts        # Command execution tests
│   │   ├── services.test.ts        # Service layer tests
│   │   └── utils.test.ts           # Utility function tests
│   ├── fixtures/                   # Test data and fixtures
│   ├── mocks/                      # Mock implementations
│   └── runTest.ts                  # Test runner configuration
├── media/                          # Documentation media
│   ├── screenshots/                # Extension screenshots
│   └── demos/                      # Demo GIFs/videos
├── docs/                           # Additional documentation
│   ├── development.md              # Development guide
│   ├── deployment.md               # Deployment instructions
│   └── api.md                      # API documentation
└── webpack.config.js               # Build configuration
```

## 3. Core Components Architecture

### 3.1 Extension Entry Point (`extension.ts`)

The main extension file that handles activation, deactivation, and registration of all components.

```typescript
export async function activate(context: vscode.ExtensionContext) {
    // Initialize services
    const configService = new ConfigService(context);
    const cliService = new CliService(configService);
    const repositoryService = new RepositoryService(cliService);
    const recipeService = new RecipeService(cliService, configService);
    
    // Register providers
    registerProviders(context, services);
    
    // Register commands
    registerCommands(context, services);
    
    // Initialize UI components
    initializeUI(context, services);
}
```

### 3.2 Service Layer Architecture

#### CLI Service (`services/cliService.ts`)
**Responsibility**: Abstract CLI interactions and provide typed responses

```typescript
export class CliService {
    private readonly configService: ConfigService;
    
    async executeCommand(args: string[]): Promise<CliResult> {
        // Command execution with error handling
        // JSON response parsing
        // License validation
    }
    
    async checkVersion(): Promise<string> { /* ... */ }
    async validateLicense(): Promise<boolean> { /* ... */ }
    async listRepositories(path: string): Promise<Repository[]> { /* ... */ }
    async runRecipe(options: RecipeRunOptions): Promise<RecipeResult> { /* ... */ }
}
```

#### Repository Service (`services/repositoryService.ts`)
**Responsibility**: Manage repository data and status tracking

```typescript
export class RepositoryService {
    private readonly cliService: CliService;
    private repositories: Repository[] = [];
    
    async getRepositories(): Promise<Repository[]> { /* ... */ }
    async refreshRepositories(): Promise<void> { /* ... */ }
    async getRepositoryStatus(repo: Repository): Promise<RepositoryStatus> { /* ... */ }
    
    // Event emitters for UI updates
    readonly onRepositoriesChanged: vscode.Event<Repository[]>;
}
```

#### Recipe Service (`services/recipeService.ts`)
**Responsibility**: Recipe detection, generation, and management

```typescript
export class RecipeService {
    private readonly cliService: CliService;
    private readonly configService: ConfigService;
    
    async detectRecipeType(document: vscode.TextDocument): Promise<RecipeType | null> { /* ... */ }
    async setActiveRecipe(recipe: Recipe): Promise<void> { /* ... */ }
    async generateRecipe(type: RecipeType, context: CodeContext): Promise<string> { /* ... */ }
    
    // Active recipe management
    async getActiveRecipe(): Promise<Recipe | null> { /* ... */ }
    readonly onActiveRecipeChanged: vscode.Event<Recipe | null>;
}
```

### 3.3 Provider Layer Architecture

#### Tree Data Provider (`providers/moderneTreeProvider.ts`)
**Responsibility**: Provide hierarchical data for the Moderne Explorer

```typescript
export class ModerneTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private readonly repositoryService: RepositoryService;
    
    getTreeItem(element: TreeItem): vscode.TreeItem { /* ... */ }
    getChildren(element?: TreeItem): Thenable<TreeItem[]> { /* ... */ }
    
    // Tree item types: Organization, Repository, Build, RecipeRun
    private createOrganizationItem(org: Organization): OrganizationTreeItem { /* ... */ }
    private createRepositoryItem(repo: Repository): RepositoryTreeItem { /* ... */ }
}
```

#### Code Action Provider (`providers/codeActionProvider.ts`)
**Responsibility**: Provide context-sensitive code actions

```typescript
export class ModerneCodeActionProvider implements vscode.CodeActionProvider {
    async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext
    ): Promise<vscode.CodeAction[]> {
        // Analyze code context
        // Return appropriate actions (Set Active Recipe, Find Usages, Create Recipe)
    }
}
```

### 3.4 Command Layer Architecture

#### Command Registration Pattern
```typescript
export function registerCommands(
    context: vscode.ExtensionContext,
    services: ServiceRegistry
): void {
    const commands = [
        new SetActiveRecipeCommand(services.recipeService),
        new FindUsagesCommand(services.repositoryService, services.cliService),
        new CreateRecipeCommand(services.recipeService),
        new DebugRecipeCommand(services.recipeService, services.cliService),
        new RefreshRepositoriesCommand(services.repositoryService)
    ];
    
    commands.forEach(cmd => cmd.register(context));
}
```

#### Command Implementation Pattern
```typescript
export class SetActiveRecipeCommand implements Command {
    constructor(private readonly recipeService: RecipeService) {}
    
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

## 4. Data Flow Architecture

### 4.1 Configuration Flow
```
VSCode Settings → ConfigService → Services → UI Components
```

### 4.2 CLI Integration Flow
```
Command Trigger → Service Layer → CliService → CLI Process → Response Parsing → UI Update
```

### 4.3 Recipe Management Flow
```
Code Analysis → Recipe Detection → Active Recipe Setting → CLI Configuration → Debug Session
```

### 4.4 Repository Data Flow
```
Configuration → CLI Query → Repository Service → Cache → Tree Provider → UI
```

## 5. State Management

### 5.1 Extension State
- **Global State**: User preferences, CLI configuration, license status
- **Workspace State**: Active recipe, repository cache, build status
- **Session State**: UI state, tree expansion, search results

### 5.2 State Persistence
```typescript
export class StateManager {
    constructor(private readonly context: vscode.ExtensionContext) {}
    
    // Global state (survives workspace changes)
    getGlobalState<T>(key: string): T | undefined { /* ... */ }
    setGlobalState<T>(key: string, value: T): Promise<void> { /* ... */ }
    
    // Workspace state (workspace-specific)
    getWorkspaceState<T>(key: string): T | undefined { /* ... */ }
    setWorkspaceState<T>(key: string, value: T): Promise<void> { /* ... */ }
}
```

### 5.3 Event-Driven Updates
```typescript
// Service layer emits events
readonly onRepositoriesChanged: vscode.Event<Repository[]>;
readonly onActiveRecipeChanged: vscode.Event<Recipe | null>;
readonly onBuildStatusChanged: vscode.Event<BuildStatus>;

// UI components listen for updates
repositoryService.onRepositoriesChanged(repos => {
    treeProvider.refresh();
});
```

## 6. Error Handling Architecture

### 6.1 Error Categories
- **CLI Errors**: Command execution failures, license issues
- **Configuration Errors**: Invalid settings, missing CLI
- **Network Errors**: Organization access, repository cloning
- **Parsing Errors**: Invalid recipe format, malformed responses

### 6.2 Error Handling Strategy
```typescript
export class ErrorHandler {
    static handle(error: Error, context: string): void {
        if (error instanceof CliError) {
            this.handleCliError(error, context);
        } else if (error instanceof ConfigurationError) {
            this.handleConfigError(error, context);
        } else {
            this.handleGenericError(error, context);
        }
    }
    
    private static showUserMessage(message: string, type: 'error' | 'warning' | 'info'): void {
        // VSCode notification with appropriate severity
    }
}
```

## 7. Performance Architecture

### 7.1 Caching Strategy
- **Repository Data**: Cache CLI responses for repository lists
- **Build Status**: Cache and refresh on demand
- **Recipe Metadata**: Cache parsed recipe information
- **Configuration**: Cache validated settings

### 7.2 Async Operations
```typescript
// All CLI operations are asynchronous
async executeCommand(args: string[]): Promise<CliResult> {
    return new Promise((resolve, reject) => {
        // Non-blocking CLI execution
        // Progress reporting for long operations
        // Cancellation support
    });
}
```

### 7.3 Resource Management
- **Process Management**: Proper cleanup of CLI processes
- **Memory Management**: Efficient tree data structures
- **File Watching**: Selective file system monitoring

## 8. Security Architecture

### 8.1 Secure CLI Integration
- **Command Sanitization**: Prevent command injection
- **Path Validation**: Secure file path handling
- **Credential Management**: No credential storage in extension

### 8.2 File System Access
- **Workspace Boundaries**: Respect workspace restrictions
- **Permission Checks**: Validate file access before operations
- **Temporary Files**: Secure handling of generated content

## 9. Testing Architecture

### 9.1 Test Structure
```
test/
├── unit/               # Unit tests for individual components
├── integration/        # Integration tests with mocked CLI
├── e2e/               # End-to-end tests with real CLI
└── fixtures/          # Test data and mock responses
```

### 9.2 Mock Strategy
```typescript
export class MockCliService implements CliService {
    private responses: Map<string, any> = new Map();
    
    setMockResponse(command: string, response: any): void { /* ... */ }
    async executeCommand(args: string[]): Promise<CliResult> { /* ... */ }
}
```

## 10. Extension Lifecycle

### 10.1 Activation
1. Load configuration
2. Validate CLI availability
3. Initialize services
4. Register providers and commands
5. Restore workspace state

### 10.2 Runtime Operations
1. Handle command executions
2. Update UI based on service events
3. Manage CLI processes
4. Cache data and state

### 10.3 Deactivation
1. Clean up CLI processes
2. Save workspace state
3. Dispose of resources
4. Unregister providers

This architecture provides a solid foundation for building a maintainable, performant, and user-friendly VSCode extension that matches the functionality of the IntelliJ Moderne Plugin.