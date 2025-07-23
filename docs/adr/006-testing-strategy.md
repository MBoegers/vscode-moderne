# ADR-006: Testing Strategy

**Date:** 2025-07-23  
**Status:** Accepted  
**Context:** VSCode Moderne Extension - Testing and Quality Assurance

## Context

The VSCode Moderne Extension requires comprehensive testing to ensure reliability, maintainability, and user experience quality. We need a testing strategy that covers unit testing, integration testing, manual testing, and end-to-end workflows.

## Decision

We will implement a **multi-layered testing strategy** with unit tests for service logic, integration tests for VSCode API interactions, and comprehensive manual testing workflows using the F5 debug environment.

### Testing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                End-to-End Testing                           │
│          (Real workflows, user scenarios)                   │
├─────────────────────────────────────────────────────────────┤
│                Integration Testing                          │
│           (VSCode API, Extension Host)                      │
├─────────────────────────────────────────────────────────────┤
│                  Unit Testing                              │
│        (Services, utilities, business logic)               │
├─────────────────────────────────────────────────────────────┤
│                Manual Testing                              │
│           (F5 debug, user acceptance)                      │
└─────────────────────────────────────────────────────────────┘
```

### Testing Framework Setup

```typescript
// Test runner configuration
export async function run(): Promise<void> {
    const { Mocha } = require('mocha');
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000
    });

    const testsRoot = path.resolve(__dirname, '..');
    const files = await glob('**/**.test.js', { cwd: testsRoot });
    
    files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));
    
    return new Promise((resolve, reject) => {
        mocha.run((failures: number) => {
            if (failures > 0) {
                reject(new Error(`${failures} tests failed.`));
            } else {
                resolve();
            }
        });
    });
}
```

### Test Categories

1. **Unit Tests**: Service logic, utilities, data models
2. **Integration Tests**: VSCode API integration, command registration
3. **Manual Tests**: F5 debug environment, user workflows
4. **Performance Tests**: Extension startup, command execution timing

## Rationale

### Testing Requirements

1. **Service Logic Validation**: Core business logic must be thoroughly tested
2. **VSCode Integration**: Ensure proper integration with VSCode APIs
3. **Command Registration**: Verify all commands are properly registered
4. **Error Handling**: Test error scenarios and user feedback
5. **Configuration Management**: Test settings validation and updates
6. **CLI Integration**: Test CLI command execution and response parsing

### Testing Principles

1. **Test Pyramid**: More unit tests, fewer integration tests, targeted E2E tests
2. **Isolation**: Tests should not depend on external services
3. **Mocking**: Mock external dependencies (CLI, file system, network)
4. **Coverage**: Aim for high test coverage of critical paths
5. **Maintainability**: Tests should be easy to understand and maintain

## Implementation Details

### Unit Testing Pattern

```typescript
// src/test/suite/services/configService.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigService } from '../../../services/configService';

suite('ConfigService Tests', () => {
    let configService: ConfigService;
    let mockContext: vscode.ExtensionContext;

    setup(() => {
        mockContext = {
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            },
            workspaceState: {
                get: jest.fn(),
                update: jest.fn()
            }
        } as any;
        
        configService = new ConfigService(mockContext);
    });

    test('should return default configuration', () => {
        const config = configService.getConfiguration();
        assert.strictEqual(config.enabled, true);
        assert.strictEqual(config.cli.useSystemPath, true);
    });

    test('should validate configuration correctly', () => {
        const errors = configService.validateConfiguration();
        assert.strictEqual(errors.length, 0);
    });
});
```

### Integration Testing Pattern

```typescript
// src/test/suite/extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Integration Tests', () => {
    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('moderne.vscode-moderne'));
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('moderne.vscode-moderne');
        assert.ok(extension);
        
        await extension!.activate();
        assert.strictEqual(extension!.isActive, true);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        
        const moderneCommands = [
            'moderne.setActiveRecipe',
            'moderne.findUsagesAllRepos',
            'moderne.createRecipe',
            'moderne.refreshRepositories',
            'moderne.checkCliStatus'
        ];

        moderneCommands.forEach(command => {
            assert.ok(
                commands.includes(command),
                `Command ${command} should be registered`
            );
        });
    });
});
```

### Mock Service Pattern

```typescript
// src/test/mocks/mockCliService.ts
import { CliService } from '../../services/cliService';
import { CliResult } from '../../models/cliResult';

export class MockCliService implements Partial<CliService> {
    private responses: Map<string, CliResult> = new Map();

    setMockResponse(command: string, response: CliResult): void {
        this.responses.set(command, response);
    }

    async executeCommand(args: string[]): Promise<CliResult> {
        const command = args.join(' ');
        return this.responses.get(command) || {
            success: false,
            error: `No mock response for: ${command}`
        };
    }

    async checkVersion(): Promise<string> {
        return '1.0.0';
    }

    async validateLicense(): Promise<boolean> {
        return true;
    }
}
```

### Command Testing Pattern

```typescript
// src/test/suite/commands/setActiveRecipeCommand.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { SetActiveRecipeCommand } from '../../../commands/setActiveRecipeCommand';
import { MockCliService } from '../../mocks/mockCliService';

suite('SetActiveRecipeCommand Tests', () => {
    let command: SetActiveRecipeCommand;
    let mockServices: any;

    setup(() => {
        mockServices = {
            recipe: {
                detectRecipeType: jest.fn().mockResolvedValue('refaster'),
                setActiveRecipe: jest.fn().mockResolvedValue(undefined)
            },
            logger: {
                info: jest.fn(),
                error: jest.fn()
            }
        };
        
        command = new SetActiveRecipeCommand(mockServices);
    });

    test('should execute without error for valid recipe', async () => {
        const mockDocument = {
            languageId: 'java',
            getText: () => '@RecipeDescriptor class TestRecipe { }'
        } as any;

        jest.spyOn(vscode.window, 'activeTextEditor', 'get').mockReturnValue({
            document: mockDocument
        } as any);

        await command.execute();
        
        assert.ok(mockServices.recipe.setActiveRecipe.called);
    });
});
```

## Testing Workflows

### 1. Unit Test Execution

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "ConfigService"

# Run tests with coverage
npm run test:coverage
```

### 2. F5 Debug Testing Workflow

**Primary development testing method:**

1. **Launch Extension Development Host**: Press F5 in VSCode
2. **Basic Functionality Tests**:
   - Extension loads without errors
   - Commands appear in Command Palette
   - Tree view displays correctly
   - Status bar integration works

3. **Command Testing**:
   - Test each command individually
   - Verify error handling
   - Check user feedback messages

4. **Integration Testing**:
   - Test context menu integration
   - Verify settings changes take effect
   - Test CLI integration (if CLI available)

### 3. Manual Testing Checklist

#### Extension Activation
- [ ] Extension loads without errors in Extension Host console
- [ ] All commands appear in Command Palette (`Ctrl/Cmd + Shift + P`)
- [ ] Moderne tree view appears in Explorer sidebar
- [ ] Status bar shows CLI status

#### Command Execution
- [ ] "Moderne: Test Extension" shows success message
- [ ] "Moderne: Check CLI Status" opens status window
- [ ] "Moderne: Refresh Repositories" shows progress
- [ ] Context menus appear on appropriate file types

#### Error Handling
- [ ] Invalid commands show helpful error messages
- [ ] Configuration errors provide guidance
- [ ] CLI unavailable scenarios handled gracefully

#### Settings Integration
- [ ] Settings appear in VSCode preferences
- [ ] Configuration changes take effect immediately
- [ ] Invalid settings show validation errors

### 4. Performance Testing

```typescript
// Performance test example
suite('Performance Tests', () => {
    test('Extension activation should complete within 2 seconds', async () => {
        const startTime = Date.now();
        
        const extension = vscode.extensions.getExtension('moderne.vscode-moderne');
        await extension!.activate();
        
        const activationTime = Date.now() - startTime;
        assert.ok(activationTime < 2000, `Activation took ${activationTime}ms`);
    });

    test('Command registration should be fast', async () => {
        const startTime = Date.now();
        
        const commands = await vscode.commands.getCommands(true);
        const moderneCommands = commands.filter(cmd => cmd.startsWith('moderne.'));
        
        const queryTime = Date.now() - startTime;
        assert.ok(queryTime < 100, `Command query took ${queryTime}ms`);
        assert.ok(moderneCommands.length >= 5, 'All commands should be registered');
    });
});
```

## Alternatives Considered

### 1. Jest as Primary Test Framework
**Consideration**: Jest provides excellent mocking capabilities and is widely used.
**Decision**: Stick with Mocha as it's the standard for VSCode extensions and integrates better with Extension Host testing.

### 2. Selenium/Playwright for E2E Testing
**Consideration**: Automated UI testing for complete user workflows.
**Decision**: Manual F5 testing is more appropriate for extension development and provides better debugging capabilities.

### 3. Property-Based Testing
**Consideration**: Generate random test inputs to find edge cases.
**Decision**: Not necessary for current scope, but could be added for specific utilities.

## Consequences

### Positive
- ✅ Comprehensive test coverage across all layers
- ✅ F5 debug workflow provides excellent development experience
- ✅ Mock services enable isolated unit testing
- ✅ Integration tests verify VSCode API compatibility
- ✅ Manual testing ensures real user experience quality

### Negative
- ❌ Test setup requires significant initial investment
- ❌ Mocking external dependencies adds complexity
- ❌ Manual testing is time-consuming
- ❌ Extension Host testing has longer feedback loops

### Mitigation Strategies

#### Automated Test Running
```json
{
  "scripts": {
    "test": "node ./out/test/runTest.js",
    "test:watch": "npm run compile && npm run test",
    "test:coverage": "nyc npm test"
  }
}
```

#### Test Data Management
```typescript
// src/test/fixtures/testData.ts
export const TEST_REPOSITORIES = [
    {
        id: 'test-repo-1',
        name: 'Test Repository',
        path: '/test/path',
        hasLst: true,
        buildStatus: BuildStatus.Success
    }
];

export const TEST_CLI_RESPONSES = {
    VERSION: { success: true, data: 'Moderne CLI version 1.0.0' },
    LICENSE_VALID: { success: true, data: { valid: true } }
};
```

## Testing Metrics and Goals

### Coverage Targets
- **Unit Tests**: 80%+ coverage of service layer
- **Integration Tests**: 100% of critical paths (activation, command registration)
- **Manual Tests**: 100% of user-facing features

### Performance Targets
- **Extension Activation**: < 2 seconds
- **Command Execution**: < 500ms for UI commands
- **CLI Operations**: < 30 seconds with proper progress reporting

### Quality Gates
- All tests must pass before merging
- No regression in extension activation
- All commands must be accessible and functional

## Implementation Status

- ✅ Mocha test framework configured
- ✅ Extension activation tests implemented
- ✅ Command registration tests implemented
- ✅ Mock service patterns established
- ✅ F5 debug testing workflow documented
- ✅ Manual testing checklist created
- ✅ Test execution scripts configured

## Future Enhancements

### 1. Automated UI Testing
```typescript
// Future: Automated UI testing
describe('UI Integration', () => {
    test('should show context menu on Java files', async () => {
        // Automated UI interaction testing
    });
});
```

### 2. Performance Monitoring
```typescript
// Future: Performance monitoring
class PerformanceMonitor {
    static measureActivation(): Promise<number> {
        // Measure and report activation time
    }
}
```

### 3. Test Coverage Reporting
```json
{
  "nyc": {
    "extends": "@istanbuljs/nyc-config-typescript",
    "include": ["src/**/*.ts"],
    "exclude": ["src/test/**"],
    "reporter": ["text", "html", "lcov"]
  }
}
```

## Related Decisions
- [ADR-001: Service Layer Architecture](./001-service-layer-architecture.md)
- [ADR-005: Command Registration Pattern](./005-command-registration-pattern.md)

---

This testing strategy ensures high-quality, reliable extension development while providing excellent debugging and development experience through comprehensive testing at all levels.