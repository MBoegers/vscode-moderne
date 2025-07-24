# VSCode Moderne Extension - Features

This document provides detailed information about all features available in the VSCode Moderne Extension.

## 📋 Table of Contents

- [Recipe Management](#recipe-management)
- [Multi-Repository Search](#multi-repository-search)
- [Recipe Development](#recipe-development)
- [CLI Integration](#cli-integration)
- [Configuration](#configuration)
- [Development Tools](#development-tools)

## 🎯 Recipe Management

### Set Active Recipe
- **Right-click context menu** on recipe classes to set them as active
- **Automatic classpath resolution** from workspace dependencies
- **Recipe validation** and error reporting
- **Integration with `mod run . --active-recipe`**

**How to use:**
1. Open a Java file containing an OpenRewrite recipe
2. Right-click on the recipe class name
3. Select "Set Active Recipe" from the context menu
4. Run `mod run . --active-recipe` in the terminal

### Repository Management
- **Tree view explorer** for multi-repos and organizations
- **Build status indicators** for LST availability
- **One-click repository refresh** and management
- **Visual status tracking** for all repositories

## 🔍 Multi-Repository Search

### Type-Aware Search
- **Search across multiple repositories** configured in your workspace
- **Context-sensitive menus** for methods, expressions, XML/YAML elements
- **Support for different search strategies**:
  - Direct find recipes
  - Custom search recipe generation

### Search Results
- **Integrated results** in VSCode's native search panel
- **Repository grouping** for organized results
- **Export functionality** for search results
- **Clear and toggle grouping options**

**How to use:**
1. Select code in any supported file type
2. Right-click and choose "Find Usages on All Repos"
3. Choose your search strategy
4. View results in the dedicated search panel

## 🛠️ Recipe Development

### Recipe Generation
- **Generate basic OpenRewrite recipes** from code selections
- **Support for different recipe types**:
  - Refaster recipes for simple transformations
  - Visitor-based recipes for complex logic
  - YAML/XML recipes for configuration changes

### Template System
- **Built-in recipe templates** for common patterns
- **Proper package structure and imports**
- **OpenRewrite annotations and metadata**
- **Template expressions based on your selections**

**How to use:**
1. Select a code pattern you want to transform
2. Right-click and choose "Create OpenRewrite Recipe..."
3. Choose the appropriate recipe type
4. The extension generates a complete recipe class

## ⚙️ CLI Integration

### Direct CLI Access
- **Seamless integration** with the Moderne CLI
- **Automatic CLI path detection** from system PATH
- **Support for custom CLI paths** and JAR files
- **Command execution with proper error handling**

### Status Monitoring
- **CLI status checking** and validation
- **License validation** and reporting
- **Version compatibility checks**
- **Real-time status updates in the status bar**

### Configuration Management
- **Settings validation** and error reporting
- **Multi-repository path management**
- **Organization configuration support**
- **Automatic configuration discovery**

## ⚙️ Configuration

### CLI Settings
```json
{
  "moderne.cli.useSystemPath": true,
  "moderne.cli.path": "/usr/local/bin/mod",
  "moderne.cli.jarPath": "/path/to/mod-cli.jar"
}
```

### Multi-Repository Settings
```json
{
  "moderne.multiRepos.localPaths": [
    "/path/to/your/multi-repo-1",
    "/path/to/your/multi-repo-2"
  ],
  "moderne.multiRepos.organizations": [
    {
      "name": "My Organization",
      "id": "my-org-id"
    }
  ]
}
```

### Recipe Settings
```json
{
  "moderne.recipes.defaultType": "refaster",
  "moderne.recipes.templatePath": "/path/to/custom/templates"
}
```

### Debug Settings
```json
{
  "moderne.debug.showInternalMethods": false,
  "moderne.debug.enableLiveEdit": true
}
```

## 🔧 Development Tools

### Testing Support
- **Comprehensive test suite** with 37+ integration tests
- **Automated testing** in CI/CD pipeline
- **Cross-platform compatibility** testing
- **Performance benchmarking** and validation

### Debugging Features
- **Basic debugging support** for recipe development
- **Integration with VS Code's debug protocol**
- **Breakpoint support** in recipe code
- **Debug console integration**

### Performance Optimizations
- **Caching layer** for CLI operations
- **Lazy loading** for tree providers
- **Optimized search result handling**
- **Memory usage optimization**

## 🔄 CI/CD Integration

### Automated Testing
- **Multi-platform testing** (Ubuntu, Windows, macOS)
- **Node.js version compatibility** (18.x, 20.x)
- **Integration test execution** with headless VSCode
- **Code coverage analysis**

### Release Automation
- **Automatic release creation** from version tags
- **Extension packaging** and validation
- **Release notes generation** from commits
- **Optional marketplace publishing**

### Security & Dependencies
- **Weekly security audits** with npm audit
- **CodeQL analysis** for code security
- **Automated dependency updates** via Dependabot
- **License compliance checking**

## 📋 Command Reference

### Available Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| `moderne.setActiveRecipe` | Set the active recipe for debugging | Right-click context |
| `moderne.findUsagesAllRepos` | Search across all repositories | Right-click context |
| `moderne.createRecipe` | Generate a new OpenRewrite recipe | Right-click context |
| `moderne.refreshRepositories` | Refresh repository list | Tree view button |
| `moderne.checkCliStatus` | Check Moderne CLI status | Status bar |
| `moderne.openConfiguration` | Open extension settings | Command palette |
| `moderne.runActiveRecipe` | Run the currently active recipe | Command palette |
| `moderne.clearSearchResults` | Clear search results panel | Search panel button |
| `moderne.toggleSearchGrouping` | Toggle grouping by repository | Search panel button |
| `moderne.exportSearchResults` | Export search results | Search panel button |

### Context Menus

**Editor Context Menu** (Java files):
- Set Active Recipe
- Find Usages on All Repos  
- Create OpenRewrite Recipe

**Tree View Context Menu**:
- Set Active Recipe (on recipe items)
- Run Active Recipe (on active recipe)

## 🎨 User Interface

### Tree Views
- **Moderne Explorer**: Repository and recipe management
- **Search Results**: Organized search result display  
- **Recipe Debug**: Debug information and controls

### Status Bar Integration
- **CLI Status Indicator**: Shows current CLI connection status
- **Quick Actions**: Access to common commands
- **Error Notifications**: Immediate feedback on issues

### Welcome Screens
- **Getting Started**: First-time user guidance
- **Configuration Help**: Setup assistance
- **Feature Discovery**: Tips and tricks

## 🔍 Troubleshooting

### Common Issues

**CLI Not Found**:
- Verify CLI is installed and in PATH
- Check `moderne.cli.path` setting
- Ensure CLI has proper permissions

**No Search Results**:
- Verify repository paths are correct
- Check that repositories have LSTs built
- Ensure CLI is properly licensed

**Recipe Not Found**:
- Verify recipe file contains proper annotations
- Check that workspace includes recipe dependencies
- Ensure recipe class is properly structured

### Debug Information

Use the "Check CLI Status" command to view:
- CLI version and location
- License status
- Repository configuration
- Extension diagnostics

## 🚀 Advanced Features

### Workflow Automation
- **Built-in workflow templates** for common tasks
- **Batch processing** capabilities
- **Progress tracking** for long-running operations
- **Error recovery** and retry mechanisms

### Pattern Detection
- **AI-assisted pattern recognition** (experimental)
- **Code smell detection** and suggestions
- **Best practice recommendations**
- **Framework-specific patterns**

### Bulk Operations
- **Multi-repository operations** in parallel
- **Batch recipe execution** across repositories
- **Progress monitoring** and cancellation support
- **Result aggregation** and reporting

---

For more technical details, see our [Architecture Documentation](spec/project-architecture.md) and [ADRs](docs/adr/).