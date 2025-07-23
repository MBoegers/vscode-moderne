# VSCode Moderne Extension Specification

## 1. Overview

The VSCode Moderne Extension provides integration with the Moderne CLI to enable recipe debugging, multi-repository code search, and recipe generation directly from VS Code. This extension ports the key functionality from the IntelliJ Moderne Plugin to VS Code, maintaining the same workflow and user experience.

## 2. Key Features

### 2.1 Set Active Recipe
**Purpose**: Designate a recipe class as the active recipe for CLI execution using `mod run . --active-recipe`

**Functionality**:
- Right-click context menu on recipe classes (Java files extending Recipe or with @RecipeDescriptor)
- Writes recipe metadata to `~/.moderne/cli/active.recipe` file including:
  - Recipe class name (qualified name for imperative, transformed name for Refaster)
  - Classpath information from workspace dependencies
  - Required options extracted from @Option annotations
  - Java home path from workspace configuration
- Shows notification on successful active recipe setup
- Integration with VSCode's language server for Java class detection

**Technical Requirements**:
- Java language detection and parsing capability
- File system access to write active recipe file
- Integration with Java workspace for classpath resolution
- Context menu contribution for Java files

### 2.2 Multi-Repository Code Search
**Purpose**: Search for code patterns across multiple repositories configured in the Moderne CLI

**Functionality**:
- Right-click "Find Usages on All Repos" context menu on methods, expressions, XML/YAML elements
- Context-aware popup with options:
  - Run Find Recipe - Direct CLI-based search using existing OpenRewrite recipes
  - Create Search Recipe (Refaster) - Generate Refaster template for the selected pattern
  - Create Search Recipe (Visitor) - Generate visitor-based search recipe
- Results displayed in VSCode's search results panel
- Progress indication during multi-repository search
- Repository grouping in search results

**Technical Requirements**:
- Language server integration for semantic code analysis
- CLI command execution with streaming output
- Search results panel integration
- Progress reporting UI
- Context menu contributions for multiple file types

### 2.3 Recipe Generation
**Purpose**: Generate OpenRewrite recipes from selected code elements

**Functionality**:
- Right-click "Create OpenRewrite Recipe..." context menu
- Support for multiple recipe types:
  - **Refaster Recipes**: Pattern-based transformations using before/after templates
  - **Visitor-based Recipes**: Imperative recipes using visitor pattern  
  - **YAML/XML Recipes**: Configuration file transformations
- Code selection analysis to build OpenRewrite JavaTemplate expressions
- Template-based code generation with proper imports and package structure
- Integration with workspace for dependency management

**Technical Requirements**:
- Code selection and semantic analysis
- Template-based code generation
- File creation and workspace integration
- Language server integration for accurate type information

### 2.4 Recipe Debugging Support
**Purpose**: Enable IDE-based debugging of recipes executed via Moderne CLI

**Functionality**:
- Launch configuration for recipe debugging
- Integration with `mod run . --jvm-debug --active-recipe` command
- Remote JVM debug connection setup
- Breakpoint support in recipe code
- Debug console integration

**Technical Requirements**:
- VSCode debugger API integration
- Remote debugging configuration
- Process management for CLI execution
- Debug adapter protocol implementation

### 2.5 Tool Window Integration
**Purpose**: Central hub for managing multi-repos, viewing builds, and recipe runs

**Functionality**:
- Tree view in VS Code explorer panel showing:
  - Configured multi-repos and organizations
  - Repository list with LST build status
  - Recipe run history and results
  - Build status indicators
- Refresh functionality for repository status
- Context actions for repositories (build, run recipes)
- Integration with Moderne CLI configuration

**Technical Requirements**:
- Tree view provider implementation
- CLI integration for data fetching
- Status indicators and icons
- Context menu actions on tree items

## 3. VSCode Integration Points

### 3.1 Commands
- `moderne.setActiveRecipe` - Set active recipe from current file
- `moderne.findUsagesAllRepos` - Multi-repository code search
- `moderne.createRecipe` - Generate OpenRewrite recipe
- `moderne.refreshRepositories` - Refresh repository list
- `moderne.runRecipe` - Execute recipe with debugging
- `moderne.openSettings` - Open extension settings

### 3.2 Context Menus
- **Java Files**: Set Active Recipe, Find Usages on All Repos, Create OpenRewrite Recipe
- **Selected Code**: Find Usages on All Repos, Create OpenRewrite Recipe
- **XML/YAML Files**: Find Usages on All Repos, Create Recipe
- **Tree View Items**: Repository-specific actions (build, run, view status)

### 3.3 Views and Panels
- **Moderne Explorer**: Tree view in explorer panel showing multi-repos, repositories, builds
- **Search Results**: Integration with VSCode search panel for multi-repo results
- **Debug Console**: Integration with debug console for recipe debugging output

### 3.4 Settings
- **CLI Configuration**:
  - `moderne.cli.path` - Path to Moderne CLI executable
  - `moderne.cli.useSystemPath` - Use CLI from system PATH
  - `moderne.cli.jarPath` - Path to CLI JAR file (alternative to executable)
- **Multi-Repository Configuration**:
  - `moderne.multiRepos.localPaths` - Array of local multi-repo paths
  - `moderne.multiRepos.organizations` - Array of Moderne organization configurations
- **Recipe Configuration**:
  - `moderne.recipes.defaultType` - Default recipe type for generation
  - `moderne.recipes.templatePath` - Custom recipe template directory

### 3.5 Status Bar
- **CLI Status**: Indicator showing CLI connection and license status
- **Active Recipe**: Display currently active recipe name
- **Repository Status**: Count of available repositories and build status

## 4. Architecture Design

### 4.1 Extension Structure
```
src/
├── extension.ts              # Main extension entry point
├── commands/                 # Command implementations
│   ├── setActiveRecipe.ts
│   ├── findUsages.ts
│   ├── createRecipe.ts
│   └── debugRecipe.ts
├── providers/                # VSCode provider implementations
│   ├── treeDataProvider.ts   # Tree view data provider
│   ├── codeActionProvider.ts # Code action contributions
│   └── debugConfigProvider.ts # Debug configuration
├── services/                 # Core business logic
│   ├── cliService.ts         # Moderne CLI integration
│   ├── recipeService.ts      # Recipe management
│   ├── repositoryService.ts  # Repository data management
│   └── configService.ts      # Settings management
├── models/                   # Data models
│   ├── repository.ts
│   ├── recipe.ts
│   └── cliResult.ts
├── utils/                    # Utility functions
│   ├── javaParser.ts         # Java code analysis
│   ├── pathUtils.ts          # File system utilities
│   └── templateGenerator.ts  # Code generation
└── test/                     # Test suites
    ├── suite/
    └── runTest.ts
```

### 4.2 Key Components

#### CLI Service
- **Responsibility**: Execute Moderne CLI commands and parse responses
- **Methods**: 
  - `executeCommand(args: string[]): Promise<CliResult>`
  - `checkVersion(): Promise<string>`
  - `validateLicense(): Promise<boolean>`
  - `listRepositories(path: string): Promise<Repository[]>`
  - `runRecipe(options: RecipeRunOptions): Promise<RecipeResult>`

#### Repository Service  
- **Responsibility**: Management of multi-repo data and repository status
- **Methods**:
  - `getRepositories(): Promise<Repository[]>`
  - `refreshRepositories(): Promise<void>`
  - `getRepositoryStatus(repo: Repository): Promise<RepositoryStatus>`

#### Recipe Service
- **Responsibility**: Recipe detection, generation, and active recipe management
- **Methods**:
  - `detectRecipeType(document: TextDocument): Promise<RecipeType | null>`
  - `setActiveRecipe(recipe: Recipe): Promise<void>`
  - `generateRecipe(type: RecipeType, context: CodeContext): Promise<string>`

#### Tree Data Provider
- **Responsibility**: Provide data for the Moderne Explorer tree view
- **Implementation**: Hierarchical display of organizations → repositories → builds → recipe runs

### 4.3 Integration Patterns

#### Language Server Integration
- Utilize Java language server for accurate semantic analysis
- Extract type information and method signatures
- Support for workspace symbol resolution

#### Debug Adapter Integration
- Custom debug configuration for recipe debugging
- Remote debugging connection management
- Integration with existing Java debug adapters

#### File System Integration
- Monitor changes to `~/.moderne/cli/active.recipe`
- Workspace file creation for generated recipes
- Configuration file management

## 5. User Experience

### 5.1 Installation and Setup
1. Install extension from VS Code marketplace
2. Configure CLI path in extension settings
3. Validate license through CLI integration
4. Configure multi-repositories (local paths or organizations)
5. Ready to use with right-click context menus

### 5.2 Primary Workflows

#### Recipe Debugging Workflow
1. Open recipe Java file in VS Code
2. Right-click on recipe class name → "Set Active Recipe"
3. Set breakpoints in recipe code
4. Open terminal and run `mod run . --jvm-debug --active-recipe`
5. VS Code automatically attaches debugger
6. Debug recipe execution with full IDE support

#### Multi-Repository Search Workflow
1. Select code element (method call, expression, etc.)
2. Right-click → "Find Usages on All Repos"
3. Choose search strategy from popup menu
4. View results in VS Code search panel
5. Navigate to results across multiple repositories

#### Recipe Creation Workflow
1. Select code pattern for transformation
2. Right-click → "Create OpenRewrite Recipe..."
3. Choose recipe type (Refaster, Visitor, YAML)
4. Extension generates complete recipe class
5. Recipe automatically added to workspace

### 5.3 Visual Design
- Consistent with VS Code design system
- Moderne branding in icons and naming
- Tree view with repository status indicators
- Progress bars for long-running operations
- Contextual notifications for success/error states

## 6. Technical Requirements

### 6.1 Dependencies
- **VS Code Engine**: ^1.75.0
- **Java Language Server**: Integration for semantic analysis
- **Node.js Dependencies**:
  - `vscode` - VS Code extension API
  - `child_process` - CLI command execution
  - `fs-extra` - File system operations
  - `path` - Path manipulation
  - `typescript` - TypeScript language support

### 6.2 Supported Languages
- **Primary**: Java (recipe files, code analysis)
- **Secondary**: XML, YAML (configuration files)
- **Template Generation**: Support for multi-language recipe generation

### 6.3 Platform Support
- **Operating Systems**: Windows, macOS, Linux
- **VS Code Versions**: 1.75.0+
- **Java Requirements**: JDK 8+ (for recipe execution)
- **Moderne CLI**: Compatible with latest CLI versions

### 6.4 Performance Considerations
- Lazy loading of repository data
- Caching of CLI responses
- Async operations for all CLI interactions
- Efficient tree view updates
- Background processing for large operations

## 7. Security and Privacy

### 7.1 Data Handling
- No sensitive data storage beyond user configuration
- CLI credentials managed through Moderne CLI configuration
- Local file system access limited to workspace and CLI output
- No external network requests beyond CLI operations

### 7.2 License Management
- License validation through Moderne CLI
- No license information stored in extension
- Graceful degradation for unlicensed usage

## 8. Testing Strategy

### 8.1 Unit Tests
- Service layer unit tests with mocked CLI responses
- Utility function tests for code parsing and generation
- Configuration management tests

### 8.2 Integration Tests  
- End-to-end tests with actual CLI integration
- VS Code extension testing framework
- Multi-platform testing automation

### 8.3 User Acceptance Testing
- Recipe debugging workflow validation
- Multi-repository search accuracy
- Recipe generation correctness
- Performance testing with large repository sets

## 9. Future Enhancements

### 9.1 Phase 2 Features
- Recipe marketplace integration
- Advanced recipe templates
- Custom organization support
- Enhanced diff visualization

### 9.2 Phase 3 Features
- Recipe collaboration features
- Advanced debugging tools
- Performance analytics
- Custom recipe validators

This specification provides a comprehensive foundation for developing the VS Code Moderne Extension while maintaining compatibility with existing Moderne CLI workflows and user expectations from the IntelliJ plugin.