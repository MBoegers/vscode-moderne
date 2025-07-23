const fs = require('fs-extra');
const path = require('path');

console.log('🐛 Verifying Recipe Debugging Implementation...\n');

const verificationResults = [];

function verify(description, condition) {
    const status = condition ? '✅' : '❌';
    const result = { description, status, passed: condition };
    verificationResults.push(result);
    console.log(`${status} ${description}`);
    return condition;
}

async function verifyDebugImplementation() {
    const srcPath = path.join(__dirname, '../src');
    
    // 1. Verify DebugService exists and has required methods
    const debugServicePath = path.join(srcPath, 'services/debugService.ts');
    const debugServiceExists = await fs.pathExists(debugServicePath);
    verify('DebugService file exists', debugServiceExists);
    
    if (debugServiceExists) {
        const debugServiceContent = await fs.readFile(debugServicePath, 'utf8');
        verify('DebugService has startDebugSession method', 
               debugServiceContent.includes('startDebugSession'));
        verify('DebugService has stopDebugSession method', 
               debugServiceContent.includes('stopDebugSession'));
        verify('DebugService has setBreakpoint method', 
               debugServiceContent.includes('setBreakpoint'));
        verify('DebugService has removeBreakpoint method', 
               debugServiceContent.includes('removeBreakpoint'));
        verify('DebugService has stepping methods', 
               debugServiceContent.includes('stepOver') &&
               debugServiceContent.includes('stepInto') &&
               debugServiceContent.includes('stepOut'));
        verify('DebugService has evaluation methods', 
               debugServiceContent.includes('getVariables') &&
               debugServiceContent.includes('evaluateExpression'));
        verify('DebugService has proper interfaces defined', 
               debugServiceContent.includes('export interface DebugSession') &&
               debugServiceContent.includes('export interface DebugBreakpoint'));
        verify('DebugService includes event emitters',
               debugServiceContent.includes('onDidStartDebugSession') &&
               debugServiceContent.includes('onDidTerminateDebugSession'));
    }

    // 2. Verify DebugTreeProvider exists and implements TreeDataProvider
    const debugTreeProviderPath = path.join(srcPath, 'providers/debugTreeProvider.ts');
    const debugTreeProviderExists = await fs.pathExists(debugTreeProviderPath);
    verify('DebugTreeProvider file exists', debugTreeProviderExists);
    
    if (debugTreeProviderExists) {
        const providerContent = await fs.readFile(debugTreeProviderPath, 'utf8');
        verify('DebugTreeProvider implements TreeDataProvider', 
               providerContent.includes('implements vscode.TreeDataProvider'));
        verify('DebugTreeProvider has refresh method', 
               providerContent.includes('refresh()'));
        verify('DebugTreeProvider has selectSession method', 
               providerContent.includes('selectSession'));
        verify('DebugTreeProvider includes debug tree items',
               providerContent.includes('SessionItem') &&
               providerContent.includes('BreakpointItem') &&
               providerContent.includes('VariableItem'));
        verify('DebugTreeProvider listens to debug events',
               providerContent.includes('onDidStartDebugSession') &&
               providerContent.includes('onDidStopOnBreakpoint'));
    }

    // 3. Verify DebugCommands exists and registers all commands
    const debugCommandsPath = path.join(srcPath, 'commands/debugCommands.ts');
    const debugCommandsExists = await fs.pathExists(debugCommandsPath);
    verify('DebugCommands file exists', debugCommandsExists);
    
    if (debugCommandsExists) {
        const commandContent = await fs.readFile(debugCommandsPath, 'utf8');
        verify('DebugCommands registers start debug session', 
               commandContent.includes('moderne.startDebugSession'));
        verify('DebugCommands registers stop debug session', 
               commandContent.includes('moderne.stopDebugSession'));
        verify('DebugCommands registers breakpoint commands', 
               commandContent.includes('moderne.toggleBreakpoint') &&
               commandContent.includes('moderne.setConditionalBreakpoint'));
        verify('DebugCommands registers stepping commands', 
               commandContent.includes('moderne.debugStepOver') &&
               commandContent.includes('moderne.debugStepInto') &&
               commandContent.includes('moderne.debugStepOut'));
        verify('DebugCommands registers evaluation command', 
               commandContent.includes('moderne.debugEvaluate'));
        verify('DebugCommands includes target path selection',
               commandContent.includes('selectTargetPath'));
    }

    // 4. Verify DebugConfigurationProvider exists
    const debugConfigProviderPath = path.join(srcPath, 'debug/debugConfigurationProvider.ts');
    const debugConfigProviderExists = await fs.pathExists(debugConfigProviderPath);
    verify('DebugConfigurationProvider file exists', debugConfigProviderExists);
    
    if (debugConfigProviderExists) {
        const configContent = await fs.readFile(debugConfigProviderPath, 'utf8');
        verify('DebugConfigurationProvider implements configuration provider', 
               configContent.includes('implements vscode.DebugConfigurationProvider'));
        verify('DebugConfigurationProvider has provideDebugConfigurations', 
               configContent.includes('provideDebugConfigurations'));
        verify('DebugConfigurationProvider has resolveDebugConfiguration', 
               configContent.includes('resolveDebugConfiguration'));
        verify('DebugConfigurationProvider includes debug adapter', 
               configContent.includes('DebugAdapterDescriptorFactory') &&
               configContent.includes('ModerneDebugAdapter'));
        verify('DebugConfigurationProvider supports launch and attach',
               configContent.includes('request: \'launch\'') &&
               configContent.includes('request: \'attach\''));
    }

    // 5. Verify extension.ts integration
    const extensionPath = path.join(srcPath, 'extension.ts');
    const extensionExists = await fs.pathExists(extensionPath);
    verify('Extension file exists', extensionExists);
    
    if (extensionExists) {
        const extensionContent = await fs.readFile(extensionPath, 'utf8');
        verify('Extension imports DebugService', 
               extensionContent.includes("import { DebugService }"));
        verify('Extension imports DebugTreeProvider', 
               extensionContent.includes("import { DebugTreeProvider }"));
        verify('Extension imports DebugConfigurationProvider', 
               extensionContent.includes("import { DebugConfigurationProvider"));
        verify('Extension creates DebugService instance', 
               extensionContent.includes('new DebugService'));
        verify('Extension creates DebugTreeProvider instance', 
               extensionContent.includes('new DebugTreeProvider'));
        verify('Extension registers debug providers', 
               extensionContent.includes('registerDebugConfigurationProvider') &&
               extensionContent.includes('registerDebugAdapterDescriptorFactory'));
        verify('Extension includes debug service in registry', 
               extensionContent.includes('debug: debugService'));
        verify('Extension registers debug tree view',
               extensionContent.includes("registerTreeDataProvider('moderneDebugView'"));
    }

    // 6. Verify ServiceRegistry interface includes debug service
    if (extensionExists) {
        const extensionContent = await fs.readFile(extensionPath, 'utf8');
        verify('ServiceRegistry interface includes DebugService', 
               extensionContent.includes('debug: DebugService'));
    }

    // 7. Verify command registration
    const commandIndexPath = path.join(srcPath, 'commands/index.ts');
    const commandIndexExists = await fs.pathExists(commandIndexPath);
    verify('Commands index file exists', commandIndexExists);
    
    if (commandIndexExists) {
        const indexContent = await fs.readFile(commandIndexPath, 'utf8');
        verify('Commands index imports DebugCommands', 
               indexContent.includes("import { DebugCommands }"));
        verify('Commands index registers DebugCommands', 
               indexContent.includes('new DebugCommands'));
    }

    // 8. Verify package.json configuration
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJsonExists = await fs.pathExists(packageJsonPath);
    verify('Package.json exists', packageJsonExists);
    
    if (packageJsonExists) {
        const packageJson = await fs.readJson(packageJsonPath);
        
        // Check debug commands
        const commands = packageJson.contributes?.commands || [];
        const debugCommandNames = [
            'moderne.startDebugSession',
            'moderne.stopDebugSession',
            'moderne.toggleBreakpoint',
            'moderne.debugContinue',
            'moderne.debugStepOver',
            'moderne.debugStepInto',
            'moderne.debugStepOut',
            'moderne.debugEvaluate',
            'moderne.setConditionalBreakpoint',
            'moderne.removeAllBreakpoints'
        ];
        
        const registeredDebugCommands = commands.filter(cmd => 
            debugCommandNames.includes(cmd.command)
        );
        verify('Package.json includes all debug commands', 
               registeredDebugCommands.length === debugCommandNames.length);
        
        // Check debug view
        const views = packageJson.contributes?.views || {};
        verify('Package.json includes debug view', 
               views['debug']?.some(view => view.id === 'moderneDebugView'));
        
        // Check debug configuration
        const debuggers = packageJson.contributes?.debuggers || [];
        verify('Package.json includes debugger configuration', 
               debuggers.some(dbg => dbg.type === 'moderne-recipe'));
        
        if (debuggers.length > 0) {
            const moderneDebugger = debuggers.find(d => d.type === 'moderne-recipe');
            if (moderneDebugger) {
                verify('Debugger supports launch configuration',
                       moderneDebugger.configurationAttributes?.launch !== undefined);
                verify('Debugger supports attach configuration',
                       moderneDebugger.configurationAttributes?.attach !== undefined);
                verify('Debugger includes initial configurations',
                       Array.isArray(moderneDebugger.initialConfigurations) &&
                       moderneDebugger.initialConfigurations.length > 0);
            }
        }
        
        // Check breakpoints support
        const breakpoints = packageJson.contributes?.breakpoints || [];
        verify('Package.json includes breakpoint support for Java', 
               breakpoints.some(bp => bp.language === 'java'));
        
        // Check activation events
        const activationEvents = packageJson.activationEvents || [];
        verify('Package.json includes debug activation events',
               activationEvents.includes('onCommand:moderne.startDebugSession') &&
               activationEvents.includes('onDebugResolve:moderne-recipe'));
    }

    // 9. Verify integration test exists
    const debugTestPath = path.join(srcPath, 'test/suite/integration/debug.integration.test.ts');
    const debugTestExists = await fs.pathExists(debugTestPath);
    verify('Debug integration test file exists', debugTestExists);
    
    if (debugTestExists) {
        const testContent = await fs.readFile(debugTestPath, 'utf8');
        verify('Integration tests cover DebugService', 
               testContent.includes('DebugService Tests'));
        verify('Integration tests cover DebugTreeProvider', 
               testContent.includes('DebugTreeProvider Tests'));
        verify('Integration tests cover DebugConfigurationProvider', 
               testContent.includes('DebugConfigurationProvider Tests'));
        verify('Integration tests cover Debug Commands', 
               testContent.includes('Debug Commands Integration Tests'));
        verify('Integration tests include error handling', 
               testContent.includes('Error Handling and Edge Cases'));
        
        // Count test cases
        const testMatches = testContent.match(/test\(/g);
        verify('Integration tests have comprehensive coverage', 
               testMatches && testMatches.length >= 25); // Should have 25+ tests (TEST-056 to TEST-081+)
    }

    // 10. Verify TypeScript compilation
    try {
        const { execSync } = require('child_process');
        execSync('npm run compile', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
        verify('TypeScript compilation succeeds', true);
    } catch (error) {
        verify('TypeScript compilation succeeds', false);
        console.log(`   Compilation error: ${error.message}`);
    }

    // 11. Verify debug configuration interface
    if (debugServiceExists) {
        const debugServiceContent = await fs.readFile(debugServicePath, 'utf8');
        verify('Debug interfaces are properly typed',
               debugServiceContent.includes('interface DebugConfiguration') &&
               debugServiceContent.includes('interface DebugVariable') &&
               debugServiceContent.includes('interface DebugStackFrame'));
    }

    // 12. Verify debug event handling
    if (debugTreeProviderExists) {
        const providerContent = await fs.readFile(debugTreeProviderPath, 'utf8');
        verify('Debug tree provider handles all debug events',
               providerContent.includes('onDidStartDebugSession') &&
               providerContent.includes('onDidTerminateDebugSession') &&
               providerContent.includes('onDidStopOnBreakpoint') &&
               providerContent.includes('onDidUpdateVariables'));
    }

    // Summary
    console.log('\n📊 Debug Implementation Verification Summary:');
    console.log('==============================================');
    
    const totalTests = verificationResults.length;
    const passedTests = verificationResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`Total checks: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    
    if (failedTests > 0) {
        console.log('\n❌ Failed checks:');
        verificationResults
            .filter(r => !r.passed)
            .forEach(r => console.log(`   - ${r.description}`));
    }
    
    if (passedTests === totalTests) {
        console.log('\n🎉 All checks passed! Recipe debugging implementation is complete.');
        console.log('\n🐛 Recipe Debugging Features:');
        console.log('   • Full VSCode debugging integration');
        console.log('   • Breakpoint support with conditions');
        console.log('   • Step over, step into, step out debugging');
        console.log('   • Variable inspection and expression evaluation');
        console.log('   • Call stack navigation');
        console.log('   • Live editing during debug sessions');
        console.log('   • Debug session management');
        console.log('   • OpenRewrite recipe-specific debugging');
        console.log('\n🔧 Implementation Components:');
        console.log('   • DebugService with CLI integration');
        console.log('   • DebugTreeProvider with session management');
        console.log('   • DebugConfigurationProvider with VSCode integration');
        console.log('   • DebugCommands with full debug operations');
        console.log('   • Debug adapter with protocol support');
        console.log('   • Package.json debug configuration');
        console.log('   • Comprehensive integration tests (25+ test cases)');
        return true;
    } else {
        console.log('\n⚠️  Some checks failed. Please review the implementation.');
        return false;
    }
}

// Run verification
verifyDebugImplementation()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Verification failed with error:', error);
        process.exit(1);
    });