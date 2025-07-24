# Release Process Documentation

This document outlines the process for creating releases for the VSCode Moderne Extension.

## Prerequisites

- [ ] All tests passing in CI/CD pipeline
- [ ] Version updated in `package.json`
- [ ] Extension packaged as `.vsix` file
- [ ] Release notes prepared

## Option 1: GitHub Web Interface (Recommended)

### Steps:
1. **Navigate to Releases**
   - Go to your repository on GitHub
   - Click "Releases" (right sidebar or under "Code" tab)
   - Click "Create a new release"

2. **Configure Release**
   - **Tag version**: `v0.1.0` (creates git tag automatically)
   - **Target**: Usually `main` branch
   - **Release title**: `v0.1.0 - Initial Release`
   - **Description**: Add comprehensive release notes

3. **Attach Assets**
   - Upload the `.vsix` extension file
   - Include any additional documentation

4. **Publish Options**
   - **Draft**: Save without publishing (recommended for review)
   - **Pre-release**: Mark as pre-release if beta/alpha
   - **Publish**: Make public immediately

### Example Release Notes Template:
```markdown
## 🚀 Features
- Multi-repository search functionality
- Recipe debugging with breakpoint support
- CLI integration and status monitoring
- Tree view for recipe management
- Advanced recipe generation

## 🐛 Bug Fixes
- Fixed integration test timeouts
- Resolved unit test X11 display errors
- Improved CI/CD pipeline stability

## ⚠️ Breaking Changes
- None in this release

## 📦 Installation
1. Download the `vscode-moderne-0.1.0.vsix` file
2. Open VSCode
3. Go to Extensions view (Ctrl+Shift+X)
4. Click "..." menu → "Install from VSIX..."
5. Select the downloaded file

## 🔧 Requirements
- VSCode 1.75.0 or higher
- Node.js 18.x or 20.x
- Moderne CLI installed
```

## Option 2: GitHub CLI

### Prerequisites:
```bash
# Install GitHub CLI if not already installed
# macOS: brew install gh
# Ubuntu: sudo apt install gh
# Windows: winget install GitHub.CLI

# Authenticate
gh auth login
```

### Create Release:
```bash
# Create draft release
gh release create v0.1.0 \
  --title "v0.1.0 - Initial Release" \
  --notes-file RELEASE_NOTES.md \
  --draft

# Upload assets to existing release
gh release upload v0.1.0 vscode-moderne-0.1.0.vsix

# Publish draft release
gh release edit v0.1.0 --draft=false
```

### Create Release Notes File:
```bash
# Create release notes file
cat > RELEASE_NOTES.md << 'EOF'
## Features
- Multi-repository search functionality
- Recipe debugging with breakpoint support
- CLI integration and status monitoring

## Installation
Download the .vsix file and install via VSCode Extensions view.
EOF
```

## Option 3: Automated Release (CI/CD)

### Current Setup:
The project has a `release.yml` workflow that can be triggered manually or automatically.

### Trigger Automated Release:
1. **Manual Trigger**:
   - Go to Actions tab on GitHub
   - Select "Release" workflow
   - Click "Run workflow"
   - Enter version tag (e.g., `v0.1.0`)

2. **Automatic Trigger** (when configured):
   - Push a tag: `git tag v0.1.0 && git push origin v0.1.0`
   - The workflow will automatically build and create release

### Release Workflow Features:
- Builds extension package
- Runs full test suite
- Creates GitHub release
- Uploads `.vsix` asset
- Publishes to VS Code Marketplace (if configured)

## Best Practices

### Version Numbers:
- Use semantic versioning: `MAJOR.MINOR.PATCH`
- `v0.1.0` - Initial release
- `v0.1.1` - Bug fixes
- `v0.2.0` - New features
- `v1.0.0` - First stable release

### Pre-Release Checklist:
- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md`
- [ ] Run `npm run compile` locally
- [ ] Run `npm run test` locally
- [ ] Run `npm run lint` locally
- [ ] Package extension: `npm run package`
- [ ] Test extension installation locally
- [ ] All CI checks passing

### Release Notes Guidelines:
- Use clear, user-focused language
- Group changes by type (Features, Bug Fixes, Breaking Changes)
- Include installation instructions
- Mention compatibility requirements
- Link to documentation for new features

### Post-Release:
- [ ] Verify release appears correctly on GitHub
- [ ] Test extension installation from release
- [ ] Update project documentation if needed
- [ ] Announce release (if applicable)
- [ ] Create next milestone for future development

## Troubleshooting

### Common Issues:
1. **Tag already exists**: Delete and recreate tag
   ```bash
   git tag -d v0.1.0
   git push origin :refs/tags/v0.1.0
   ```

2. **CI workflow fails**: Check logs in Actions tab
3. **Asset upload fails**: Ensure file exists and permissions are correct
4. **Release notes formatting**: Use Markdown preview to verify

### Support:
- GitHub Releases Documentation: https://docs.github.com/en/repositories/releasing-projects-on-github
- GitHub CLI Documentation: https://cli.github.com/manual/gh_release
- VSCode Extension Publishing: https://code.visualstudio.com/api/working-with-extensions/publishing-extension