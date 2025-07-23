# VSCode Moderne Extension

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/moderne.vscode-moderne?style=flat&label=VS%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=moderne.vscode-moderne)
[![License](https://img.shields.io/github/license/moderneinc/vscode-moderne)](LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/moderneinc/vscode-moderne/ci.yml?branch=main)](https://github.com/moderneinc/vscode-moderne/actions)

The official Visual Studio Code extension for [Moderne](https://moderne.io), providing seamless integration with the Moderne CLI for recipe debugging, multi-repository code search, and automated recipe generation.

## ✨ Features

### 🎯 Set Active Recipe
- **Right-click context menu** on recipe classes to set them as active
- **One-click debugging** with `mod run . --active-recipe`
- **Automatic classpath resolution** from workspace dependencies
- **Recipe validation** and error reporting

![Set Active Recipe Demo](media/set-active-recipe.gif)

### 🔍 Multi-Repository Code Search
- **Type-aware search** across all configured repositories
- **Context-sensitive menus** for methods, expressions, XML/YAML elements
- **Integrated results** in VSCode's native search panel
- **Repository grouping** for organized results

![Multi-Repo Search Demo](media/multi-repo-search.gif)

### 🛠️ Recipe Generation
- **Generate Refaster recipes** from code selections
- **Create visitor-based recipes** for complex transformations
- **YAML/XML recipe support** for configuration changes
- **Template-based generation** with proper imports and structure

![Recipe Generation Demo](media/recipe-generation.gif)

### 🐛 Recipe Debugging
- **IDE breakpoint support** in recipe code
- **Remote debugging integration** with Moderne CLI
- **Debug console integration** for real-time output
- **Step-through debugging** for recipe development

![Recipe Debugging Demo](media/recipe-debugging.gif)

### 📁 Repository Management
- **Tree view explorer** for multi-repos and organizations
- **Build status indicators** for LST availability
- **One-click repository refresh** and management
- **Visual status tracking** for all repositories

![Repository Management](media/repository-management.png)

## 🚀 Quick Start

### Prerequisites

- **VS Code** 1.75.0 or higher
- **Java** 8+ installed and configured
- **[Moderne CLI](https://docs.moderne.io/moderne-cli)** installed and licensed

### Installation

1. **Install from VS Code Marketplace**
   ```
   ext install moderne.vscode-moderne
   ```

2. **Or install from VSIX**
   - Download the latest `.vsix` from [Releases](https://github.com/moderneinc/vscode-moderne/releases)
   - Run `code --install-extension moderne-vscode-*.vsix`

### Configuration

1. **Open VS Code Settings** (`Ctrl/Cmd + ,`)
2. **Search for "Moderne"**
3. **Configure CLI path**:
   - Use system PATH (recommended): Enable `Moderne: Use System Path`
   - Custom path: Set `Moderne: CLI Path` to your CLI executable
   - JAR file: Set `Moderne: CLI Jar Path` for JAR-based installations

4. **Configure repositories**:
   - **Local multi-repos**: Add paths to `Moderne: Multi Repos > Local Paths`
   - **Organizations**: Add organization configs to `Moderne: Multi Repos > Organizations`

![Configuration Screenshot](media/configuration.png)

### Verify Installation

1. **Check CLI integration**: Open Command Palette (`Ctrl/Cmd + Shift + P`) → "Moderne: Check CLI Status"
2. **View repositories**: Check the Moderne Explorer in the sidebar
3. **Test active recipe**: Right-click on a recipe class → "Set Active Recipe"

## 📖 Usage

### Setting an Active Recipe

1. **Open a recipe file** (Java class extending `Recipe` or with `@RecipeDescriptor`)
2. **Right-click on the class name** → "Set Active Recipe"
3. **Run your recipe**: Open terminal and execute `mod run . --active-recipe`

The extension automatically:
- ✅ Writes recipe metadata to `~/.moderne/cli/active.recipe`
- ✅ Resolves classpath from your workspace
- ✅ Extracts required options from `@Option` annotations
- ✅ Configures Java home from workspace settings

### Multi-Repository Search

1. **Select code element** (method call, expression, XML tag, etc.)
2. **Right-click** → "Find Usages on All Repos"
3. **Choose search strategy**:
   - **Run Find Recipe**: Direct search using OpenRewrite's find recipes
   - **Create Search Recipe**: Generate custom search recipe

Results appear in VS Code's search panel with repository grouping.

### Creating Recipes

1. **Select code pattern** you want to transform
2. **Right-click** → "Create OpenRewrite Recipe..."
3. **Choose recipe type**:
   - **Refaster**: For simple before/after transformations
   - **Visitor**: For complex imperative logic
   - **YAML/XML**: For configuration changes

The extension generates a complete recipe class with:
- ✅ Proper package structure and imports
- ✅ OpenRewrite annotations and metadata
- ✅ Template expressions based on your selection
- ✅ Required dependencies and classpath setup

### Recipe Debugging

1. **Set breakpoints** in your recipe code
2. **Set the recipe as active** (right-click → "Set Active Recipe")
3. **Start debug session**: Terminal → `mod run . --jvm-debug --active-recipe`
4. **VS Code automatically attaches** the debugger
5. **Debug normally** with step-through, variable inspection, etc.

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

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/moderneinc/vscode-moderne.git
   cd vscode-moderne
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Open in VS Code**
   ```bash
   code .
   ```

4. **Start debugging** (`F5`) to launch Extension Development Host

## 🔄 CI/CD & Workflows

Our project uses GitHub Actions for comprehensive automated testing, security scanning, and releases.

### 🚀 Continuous Integration (`ci.yml`)

**Triggers**: Every push to `main`/`develop` and all pull requests to `main`

**Multi-Stage Pipeline**:
- **Lint & Code Quality** - ESLint, TypeScript compilation, package.json validation
- **Core Tests** - Fundamental functionality validation
- **Cross-Platform Matrix** - Ubuntu/Windows/macOS with Node 18.x/20.x
- **Integration Tests** - Full VSCode extension testing with xvfb (headless)
- **Code Coverage** - Coverage analysis with Codecov integration (main branch only)
- **Package Testing** - Extension packaging validation with VSCE
- **Security & Dependencies** - npm audit, license compliance, dependency checks

**Cross-Platform Support**: Ensures extension works on all major platforms with comprehensive test matrix.

### 📦 Release Automation (`release.yml`)

**Triggers**: 
- Version tags (`v*.*.*`, `v*.*.*-*`) 
- Manual dispatch with version input

**Release Pipeline**:
1. **Validation** - Version format, full test suite execution
2. **Build & Test** - Comprehensive testing including integration tests
3. **Release Notes** - Automatic generation from git commits (conventional commits)
4. **GitHub Release** - Creates release with packaged extension attachment
5. **Marketplace Publishing** - Optional publishing to VS Code Marketplace (requires `VSCE_PAT` secret)

**Features**:
- Automatic semver validation
- Prerelease support (`v1.0.0-beta.1`)
- Draft release option
- Automatic changelog generation
- Extension package verification

### 🔒 Security & Dependencies (`security.yml`)

**Triggers**: Weekly schedule (Mondays 9 AM UTC), dependency file changes, manual dispatch

**Security Pipeline**:
- **Security Audit** - npm audit with severity thresholds
- **Dependency Updates** - Outdated dependency detection
- **License Compliance** - Automated license checking
- **CodeQL Analysis** - GitHub's semantic code analysis
- **Automated Issue Creation** - Creates GitHub issues for critical/high vulnerabilities

### ✅ Pull Request Validation (`pr-validation.yml`)

**Comprehensive PR Checks**:
- **Metadata Validation** - Conventional commit format, adequate description, branch naming
- **Code Quality** - Linting, TypeScript compilation, TODO/FIXME detection
- **Test Execution** - Core and integration test runs
- **Breaking Changes** - API change detection and documentation requirements
- **Security Scanning** - Vulnerability and secret detection
- **Bundle Size Impact** - Size analysis and impact reporting

### 🤖 Dependency Management (`dependabot.yml`)

**Automated Updates**:
- **npm dependencies** - Weekly updates with grouped minor/patch versions
- **GitHub Actions** - Weekly action version updates
- **Security Priority** - Immediate security updates
- **Review Assignment** - Automatic reviewer assignment to maintainers

### Commands for Local Development

```bash
# Run linting
npm run lint

# Compile TypeScript
npm run compile

# Run full test suite locally
npm test
npm run test:integration  # Requires display server
npm run test:unit

# Generate test coverage
npm run test:coverage

# Package extension
npm run package
```

### Release Process

**Automated Release** (Recommended):
```bash
# Create and push a version tag
git tag v1.2.3
git push origin v1.2.3
# GitHub Actions handles the rest
```

**Manual Release**:
1. Go to GitHub Actions → Release workflow
2. Click "Run workflow"
3. Enter version number (e.g., `1.2.3`)
4. Select prerelease/draft options as needed

**Marketplace Publishing**:
- Requires `VSCE_PAT` repository secret
- Only publishes stable releases (not prereleases)
- Automatic on successful release creation

### Project Structure

```
├── src/                    # Source code
│   ├── commands/          # Command implementations
│   ├── providers/         # VS Code provider implementations
│   ├── services/          # Business logic services
│   ├── models/            # Data models and interfaces
│   └── utils/             # Utility functions
├── spec/                  # Project specification and docs
├── test/                  # Test suites
└── media/                 # Screenshots and demos
```

See our [Architecture Documentation](spec/project-architecture.md) for detailed technical information.

## 📚 Documentation

### 📋 Testing & Quality Assurance
- **[Integration Tests Documentation](docs/integration-tests.md)** - 37 automated integration tests
- **[Manual Test Plan](MANUAL_TEST_PLAN.md)** - Comprehensive manual testing procedures  
- **[Test Automation Guide](TEST_AUTOMATION.md)** - Automation strategy and CI/CD integration
- **[Automation Summary](AUTOMATION_SUMMARY.md)** - Test coverage and benefits analysis

### 🏗️ Architecture & Development
- **[Documentation Hub](docs/README.md)** - Complete documentation index
- **[Architectural Decision Records](docs/adr/)** - Key technical decisions and rationale
- **[Technical Learnings](docs/learnings/)** - Development insights and best practices
- **[Extension Specification](spec/vscode-moderne-extension-specification.md)** - Complete feature specification
- **[Project Architecture](spec/project-architecture.md)** - Technical architecture and design patterns
- **[Implementation Plan](spec/implementation-plan.md)** - Development roadmap and phases

### 📖 Usage & Examples
- **[Use Cases](spec/usecases/)** - Detailed usage scenarios and workflows

## 🐛 Issues and Support

- **Bug Reports**: [GitHub Issues](https://github.com/moderneinc/vscode-moderne/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/moderneinc/vscode-moderne/discussions)
- **Documentation**: [Moderne Docs](https://docs.moderne.io/)
- **Community**: [Moderne Discord](https://discord.gg/moderne)

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🏢 About Moderne

[Moderne](https://moderne.io) provides automated code transformation and analysis tools for large-scale codebases. Our platform helps engineering teams modernize applications, fix vulnerabilities, and maintain code quality at scale.

---

**Made with ❤️ by [MBoegie.dev](https://mboegie.dev/) and Claude Code**