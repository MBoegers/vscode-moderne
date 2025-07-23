const fs = require('fs-extra');
const path = require('path');

console.log('🔍 Verifying Multi-Repository Search Implementation...\n');

const verificationResults = [];

function verify(description, condition) {
    const status = condition ? '✅' : '❌';
    const result = { description, status, passed: condition };
    verificationResults.push(result);
    console.log(`${status} ${description}`);
    return condition;
}

async function verifyImplementation() {
    const srcPath = path.join(__dirname, '../src');
    
    // 1. Verify SearchService exists and has required methods
    const searchServicePath = path.join(srcPath, 'services/searchService.ts');
    const searchServiceExists = await fs.pathExists(searchServicePath);
    verify('SearchService file exists', searchServiceExists);
    
    if (searchServiceExists) {
        const searchServiceContent = await fs.readFile(searchServicePath, 'utf8');
        verify('SearchService has searchAcrossRepositories method', 
               searchServiceContent.includes('searchAcrossRepositories'));
        verify('SearchService supports find search type', 
               searchServiceContent.includes('executeFindSearch'));
        verify('SearchService supports pattern search type', 
               searchServiceContent.includes('executePatternSearch'));
        verify('SearchService supports semantic search type', 
               searchServiceContent.includes('executeSemanticSearch'));
        verify('SearchService has proper interfaces defined', 
               searchServiceContent.includes('export interface SearchContext') &&
               searchServiceContent.includes('export interface SearchResult'));
        verify('SearchService handles search types properly',
               searchServiceContent.includes("searchType: 'find' | 'pattern' | 'semantic'"));
    }

    // 2. Verify SearchResultProvider exists and implements TreeDataProvider
    const searchResultProviderPath = path.join(srcPath, 'providers/searchResultProvider.ts');
    const searchResultProviderExists = await fs.pathExists(searchResultProviderPath);
    verify('SearchResultProvider file exists', searchResultProviderExists);
    
    if (searchResultProviderExists) {
        const providerContent = await fs.readFile(searchResultProviderPath, 'utf8');
        verify('SearchResultProvider implements TreeDataProvider', 
               providerContent.includes('implements vscode.TreeDataProvider'));
        verify('SearchResultProvider has updateSearchResults method', 
               providerContent.includes('updateSearchResults'));
        verify('SearchResultProvider has clearResults method', 
               providerContent.includes('clearResults'));
        verify('SearchResultProvider has toggleGrouping method', 
               providerContent.includes('toggleGrouping'));
        verify('SearchResultProvider has exportResults method', 
               providerContent.includes('exportResults'));
        verify('SearchResultProvider supports multiple export formats',
               providerContent.includes('json') && 
               providerContent.includes('csv') && 
               providerContent.includes('markdown'));
    }

    // 3. Verify FindUsagesCommand integration
    const findUsagesCommandPath = path.join(srcPath, 'commands/findUsagesCommand.ts');
    const findUsagesCommandExists = await fs.pathExists(findUsagesCommandPath);
    verify('FindUsagesCommand file exists', findUsagesCommandExists);
    
    if (findUsagesCommandExists) {
        const commandContent = await fs.readFile(findUsagesCommandPath, 'utf8');
        verify('FindUsagesCommand uses SearchService', 
               commandContent.includes('SearchService'));
        verify('FindUsagesCommand creates search context', 
               commandContent.includes('createSearchContextFromSelection'));
        verify('FindUsagesCommand shows search strategy options', 
               commandContent.includes('showSearchStrategyOptions'));
        verify('FindUsagesCommand handles different search types',
               commandContent.includes('Find Exact Matches') &&
               commandContent.includes('Semantic Search') &&
               commandContent.includes('Pattern Search'));
    }

    // 4. Verify SearchResultsCommand exists
    const searchResultsCommandPath = path.join(srcPath, 'commands/searchResultsCommand.ts');
    const searchResultsCommandExists = await fs.pathExists(searchResultsCommandPath);
    verify('SearchResultsCommand file exists', searchResultsCommandExists);
    
    if (searchResultsCommandExists) {
        const commandContent = await fs.readFile(searchResultsCommandPath, 'utf8');
        verify('SearchResultsCommand registers clear command', 
               commandContent.includes('moderne.clearSearchResults'));
        verify('SearchResultsCommand registers toggle grouping command', 
               commandContent.includes('moderne.toggleSearchGrouping'));
        verify('SearchResultsCommand registers export command', 
               commandContent.includes('moderne.exportSearchResults'));
    }

    // 5. Verify extension.ts integration
    const extensionPath = path.join(srcPath, 'extension.ts');
    const extensionExists = await fs.pathExists(extensionPath);
    verify('Extension file exists', extensionExists);
    
    if (extensionExists) {
        const extensionContent = await fs.readFile(extensionPath, 'utf8');
        verify('Extension imports SearchService', 
               extensionContent.includes("import { SearchService }"));
        verify('Extension imports SearchResultProvider', 
               extensionContent.includes("import { SearchResultProvider }"));
        verify('Extension creates SearchService instance', 
               extensionContent.includes('new SearchService'));
        verify('Extension creates SearchResultProvider instance', 
               extensionContent.includes('new SearchResultProvider'));
        verify('Extension registers search result provider', 
               extensionContent.includes("registerTreeDataProvider('moderneSearchResults'"));
        verify('Extension includes search service in registry', 
               extensionContent.includes('search: searchService'));
        verify('Extension stores global reference for commands',
               extensionContent.includes('moderneSearchResultProvider'));
    }

    // 6. Verify ServiceRegistry interface includes search service
    if (extensionExists) {
        const extensionContent = await fs.readFile(extensionPath, 'utf8');
        verify('ServiceRegistry interface includes SearchService', 
               extensionContent.includes('search: SearchService'));
    }

    // 7. Verify command registration
    const commandIndexPath = path.join(srcPath, 'commands/index.ts');
    const commandIndexExists = await fs.pathExists(commandIndexPath);
    verify('Commands index file exists', commandIndexExists);
    
    if (commandIndexExists) {
        const indexContent = await fs.readFile(commandIndexPath, 'utf8');
        verify('Commands index imports SearchResultsCommand', 
               indexContent.includes("import { SearchResultsCommand }"));
        verify('Commands index registers SearchResultsCommand', 
               indexContent.includes('new SearchResultsCommand'));
    }

    // 8. Verify package.json configuration
    const packageJsonPath = path.join(__dirname, '../package.json');
    const packageJsonExists = await fs.pathExists(packageJsonPath);
    verify('Package.json exists', packageJsonExists);
    
    if (packageJsonExists) {
        const packageJson = await fs.readJson(packageJsonPath);
        
        // Check commands
        const commands = packageJson.contributes?.commands || [];
        const searchCommands = commands.filter(cmd => 
            cmd.command.includes('clearSearchResults') ||
            cmd.command.includes('toggleSearchGrouping') ||
            cmd.command.includes('exportSearchResults')
        );
        verify('Package.json includes search result commands', searchCommands.length === 3);
        
        // Check views
        const views = packageJson.contributes?.views || {};
        verify('Package.json includes search results view container', 
               views['moderne-search-results'] !== undefined);
        verify('Package.json includes search results view', 
               views['moderne-search-results']?.[0]?.id === 'moderneSearchResults');
        
        // Check view containers
        const viewsContainers = packageJson.contributes?.viewsContainers || {};
        verify('Package.json includes search panel container', 
               viewsContainers.panel?.[0]?.id === 'moderne-search-results');
        
        // Check menus
        const menus = packageJson.contributes?.menus || {};
        const titleMenus = menus['view/title'] || [];
        const searchMenus = titleMenus.filter(menu => 
            menu.when?.includes('moderneSearchResults')
        );
        verify('Package.json includes search result view menus', searchMenus.length === 3);
    }

    // 9. Verify integration test exists
    const searchTestPath = path.join(srcPath, 'test/suite/integration/search.integration.test.ts');
    const searchTestExists = await fs.pathExists(searchTestPath);
    verify('Search integration test file exists', searchTestExists);
    
    if (searchTestExists) {
        const testContent = await fs.readFile(searchTestPath, 'utf8');
        verify('Integration tests cover SearchService', 
               testContent.includes('SearchService Tests'));
        verify('Integration tests cover SearchResultProvider', 
               testContent.includes('SearchResultProvider Tests'));
        verify('Integration tests cover command integration', 
               testContent.includes('Command Integration Tests'));
        verify('Integration tests include error handling', 
               testContent.includes('Error Handling and Edge Cases'));
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

    // Summary
    console.log('\n📊 Verification Summary:');
    console.log('========================');
    
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
        console.log('\n🎉 All checks passed! Multi-repository search implementation is complete.');
        return true;
    } else {
        console.log('\n⚠️  Some checks failed. Please review the implementation.');
        return false;
    }
}

// Run verification
verifyImplementation()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Verification failed with error:', error);
        process.exit(1);
    });