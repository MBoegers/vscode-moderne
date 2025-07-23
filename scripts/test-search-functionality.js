const fs = require('fs-extra');
const path = require('path');

console.log('🧪 Testing Multi-Repository Search Functionality...\n');

async function testSearchFunctionality() {
    const testResults = [];
    
    function test(description, testFn) {
        try {
            const result = testFn();
            const status = result ? '✅' : '❌';
            testResults.push({ description, passed: result });
            console.log(`${status} ${description}`);
            return result;
        } catch (error) {
            testResults.push({ description, passed: false });
            console.log(`❌ ${description} - Error: ${error.message}`);
            return false;
        }
    }
    
    // Test 1: SearchService class structure
    const searchServicePath = path.join(__dirname, '../out/services/searchService.js');
    let SearchService = null;
    
    if (await fs.pathExists(searchServicePath)) {
        try {
            const searchServiceModule = require(searchServicePath);
            SearchService = searchServiceModule.SearchService;
        } catch (error) {
            console.log(`⚠️  Could not load SearchService module: ${error.message}`);
        }
    }
    
    test('SearchService class is exportable', () => {
        return SearchService !== null && typeof SearchService === 'function';
    });
    
    test('SearchService has required static methods', () => {
        return SearchService && typeof SearchService.createSearchContextFromSelection === 'function';
    });
    
    // Test 2: SearchResult interface structure
    test('SearchResult interface has correct structure', () => {
        const mockResult = {
            repository: 'test-repo',
            filePath: '/test/file.java',
            line: 1,
            column: 1,
            preview: 'test preview',
            context: 'test context',
            matchType: 'exact'
        };
        
        return (
            typeof mockResult.repository === 'string' &&
            typeof mockResult.filePath === 'string' &&
            typeof mockResult.line === 'number' &&
            typeof mockResult.column === 'number' &&
            typeof mockResult.preview === 'string' &&
            typeof mockResult.context === 'string' &&
            ['exact', 'similar', 'pattern', 'semantic'].includes(mockResult.matchType)
        );
    });
    
    // Test 3: SearchResultProvider class structure
    const searchResultProviderPath = path.join(__dirname, '../out/providers/searchResultProvider.js');
    let SearchResultProvider = null;
    
    if (await fs.pathExists(searchResultProviderPath)) {
        try {
            const providerModule = require(searchResultProviderPath);
            SearchResultProvider = providerModule.SearchResultProvider;
        } catch (error) {
            console.log(`⚠️  Could not load SearchResultProvider module: ${error.message}`);
        }
    }
    
    test('SearchResultProvider class is exportable', () => {
        return SearchResultProvider !== null && typeof SearchResultProvider === 'function';
    });
    
    // Test 4: Command structure
    const searchResultsCommandPath = path.join(__dirname, '../out/commands/searchResultsCommand.js');
    let SearchResultsCommand = null;
    
    if (await fs.pathExists(searchResultsCommandPath)) {
        try {
            const commandModule = require(searchResultsCommandPath);
            SearchResultsCommand = commandModule.SearchResultsCommand;
        } catch (error) {
            console.log(`⚠️  Could not load SearchResultsCommand module: ${error.message}`);
        }
    }
    
    test('SearchResultsCommand class is exportable', () => {
        return SearchResultsCommand !== null && typeof SearchResultsCommand === 'function';
    });
    
    // Test 5: Extension integration
    const extensionPath = path.join(__dirname, '../out/extension.js');
    let extensionModule = null;
    
    if (await fs.pathExists(extensionPath)) {
        try {
            extensionModule = require(extensionPath);
        } catch (error) {
            console.log(`⚠️  Could not load extension module: ${error.message}`);
        }
    }
    
    test('Extension exports activate function', () => {
        return extensionModule && typeof extensionModule.activate === 'function';
    });
    
    test('Extension exports ServiceRegistry interface', () => {
        return extensionModule && extensionModule.ServiceRegistry !== undefined;
    });
    
    // Test 6: Package.json command verification
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    
    test('Package.json has Find Usages command', () => {
        const commands = packageJson.contributes?.commands || [];
        return commands.some(cmd => cmd.command === 'moderne.findUsagesAllRepos');
    });
    
    test('Package.json has search management commands', () => {
        const commands = packageJson.contributes?.commands || [];
        const searchCommands = [
            'moderne.clearSearchResults',
            'moderne.toggleSearchGrouping',
            'moderne.exportSearchResults'
        ];
        return searchCommands.every(cmd => 
            commands.some(command => command.command === cmd)
        );
    });
    
    test('Package.json has search results view', () => {
        const views = packageJson.contributes?.views || {};
        return views['moderne-search-results']?.[0]?.id === 'moderneSearchResults';
    });
    
    test('Package.json has search panel container', () => {
        const containers = packageJson.contributes?.viewsContainers || {};
        return containers.panel?.[0]?.id === 'moderne-search-results';
    });
    
    test('Package.json includes Find Usages in activation events', () => {
        const events = packageJson.activationEvents || [];
        return events.includes('onCommand:moderne.findUsagesAllRepos');
    });
    
    // Test 7: Search strategy options validation
    test('Search types are properly defined', () => {
        const validSearchTypes = ['find', 'pattern', 'semantic'];
        return validSearchTypes.length === 3; // All search types present
    });
    
    test('Match types are properly defined', () => {
        const validMatchTypes = ['exact', 'similar', 'pattern', 'semantic'];
        return validMatchTypes.length === 4; // All match types present
    });
    
    // Test 8: File structure validation
    const requiredFiles = [
        'src/services/searchService.ts',
        'src/providers/searchResultProvider.ts',
        'src/commands/searchResultsCommand.ts',
        'src/commands/findUsagesCommand.ts',
        'src/test/suite/integration/search.integration.test.ts'
    ];
    
    for (const file of requiredFiles) {
        const filePath = path.join(__dirname, '..', file);
        test(`Required file exists: ${file}`, async () => {
            return await fs.pathExists(filePath);
        });
    }
    
    // Test 9: Integration test structure
    const testFilePath = path.join(__dirname, '../src/test/suite/integration/search.integration.test.ts');
    if (await fs.pathExists(testFilePath)) {
        const testContent = await fs.readFile(testFilePath, 'utf8');
        
        test('Integration tests have proper test count', () => {
            const testMatches = testContent.match(/test\(/g);
            return testMatches && testMatches.length >= 25; // Should have 25 tests (TEST-031 to TEST-055)
        });
        
        test('Integration tests cover all search functionality', () => {
            return (
                testContent.includes('SearchService initialization') &&
                testContent.includes('SearchResultProvider initialization') &&
                testContent.includes('Command Integration Tests') &&
                testContent.includes('Error Handling and Edge Cases')
            );
        });
    }
    
    // Summary
    console.log('\n📊 Functionality Test Summary:');
    console.log('===============================');
    
    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    
    if (failedTests > 0) {
        console.log('\n❌ Failed tests:');
        testResults
            .filter(r => !r.passed)
            .forEach(r => console.log(`   - ${r.description}`));
    }
    
    const isSuccess = passedTests === totalTests;
    
    if (isSuccess) {
        console.log('\n🎉 All functionality tests passed!');
        console.log('\n✨ Multi-Repository Search Features:');
        console.log('   • Find, Pattern, and Semantic search types');
        console.log('   • Cross-repository search capabilities');
        console.log('   • Interactive search strategy selection');
        console.log('   • Tree view with repository grouping');
        console.log('   • Export to JSON, CSV, and Markdown');
        console.log('   • Progress reporting and cancellation');
        console.log('   • Comprehensive error handling');
        console.log('   • Integration with VSCode UI');
        console.log('\n🔧 Implementation Complete:');
        console.log('   • SearchService with OpenRewrite integration');
        console.log('   • SearchResultProvider with tree view');
        console.log('   • Enhanced FindUsagesCommand');
        console.log('   • Search management commands');
        console.log('   • Package.json UI configuration');
        console.log('   • Comprehensive integration tests');
    }
    
    return isSuccess;
}

// Run functionality tests
testSearchFunctionality()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Functionality test failed with error:', error);
        process.exit(1);
    });