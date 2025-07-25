# VSCode Moderne Extension

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Continuous Integration](https://github.com/MBoegers/vscode-moderne/actions/workflows/ci.yml/badge.svg)](https://github.com/MBoegers/vscode-moderne/actions/workflows/ci.yml)

> [!WARNING]  
> This extention is a spec driven purly vibe coded experiment and not meant for productive use. There will be no support nor further development.

A community-developed Visual Studio Code extension for [Moderne](https://moderne.io) that integrates with the Moderne CLI to streamline OpenRewrite recipe development and testing.

> **Note**: This is an unofficial, community-maintained extension and is not officially endorsed or supported by Moderne Inc.

## Quick Start

### Prerequisites
- **VS Code** 1.75.0 or higher
- **Java** 8+ installed and configured
- **[Moderne CLI](https://docs.moderne.io/moderne-cli)** installed and licensed

### Installation

Install from the VS Code Marketplace or download the latest `.vsix` from [Releases](https://github.com/moderneinc/vscode-moderne/releases):

```bash
code --install-extension moderne-vscode-*.vsix
```

### Basic Configuration

1. Open VS Code Settings (`Ctrl/Cmd + ,`)
2. Search for "Moderne"
3. Configure your Moderne CLI path
4. Add your repository paths

## Core Features

This extension provides essential functionality for OpenRewrite recipe development:

**🎯 Recipe Management**
- Set active recipes with right-click context menu
- Run recipes directly with `mod run . --active-recipe`
- Repository management and status tracking

**🔍 Multi-Repository Search**
- Search for code patterns across multiple repositories
- Context-sensitive search from selected code
- Integrated results in VS Code's search panel

**🛠️ Recipe Development**
- Generate basic OpenRewrite recipes from code selections
- Recipe templates for common patterns
- Simple debugging support integration

**⚙️ CLI Integration**
- Direct integration with Moderne CLI
- Configuration management
- Status monitoring and error reporting

For detailed feature documentation, see [FEATURES.md](FEATURES.md).

## Contributing

We welcome contributions! This project follows standard open-source practices:

### Development Setup

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/moderneinc/vscode-moderne.git
   cd vscode-moderne
   npm install
   ```

2. **Open in VS Code and start debugging**
   ```bash
   code .
   # Press F5 to launch Extension Development Host
   ```

3. **Run tests**
   ```bash
   npm test
   npm run test:integration
   ```

### Contributing Guidelines

- Follow existing code patterns and conventions
- Write tests for new functionality
- Update documentation as needed
- Submit pull requests with clear descriptions

See our [Contributing Guide](CONTRIBUTING.md) for detailed information.

## Documentation

- **[Features](FEATURES.md)** - Detailed feature documentation
- **[Architecture](spec/project-architecture.md)** - Technical architecture and design
- **[ADRs](docs/adr/)** - Architectural decision records
- **[Testing](docs/integration-tests.md)** - Testing documentation

## Support & Issues

- **Bug Reports & Feature Requests**: [GitHub Issues](https://github.com/moderneinc/vscode-moderne/issues)
- **Discussions**: [GitHub Discussions](https://github.com/moderneinc/vscode-moderne/discussions)
- **Moderne Documentation**: [docs.moderne.io](https://docs.moderne.io/)

## License

This project is licensed under the [MIT License](LICENSE).

---

**Disclaimer**: This extension is a community project and is not officially affiliated with or endorsed by Moderne Inc. For official Moderne tools and support, visit [moderne.io](https://moderne.io).
