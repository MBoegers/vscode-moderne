import * as vscode from 'vscode';
import { Command } from './baseCommand';
import { SearchService, SearchContext } from '../services/searchService';

export class FindUsagesCommand extends Command {
    register(context: vscode.ExtensionContext): void {
        const disposable = vscode.commands.registerCommand(
            'moderne.findUsagesAllRepos',
            this.execute.bind(this)
        );
        context.subscriptions.push(disposable);
    }

    async execute(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showErrorMessage('Please select code to search for');
                return;
            }

            const selectedText = editor.document.getText(selection);
            
            // Show search strategy options
            const searchType = await this.showSearchStrategyOptions(selectedText);
            if (!searchType) {
                return;
            }

            // Create search context
            const searchContext = SearchService.createSearchContextFromSelection(editor, selection);
            
            // Execute search
            await this.executeSearch(searchContext, searchType);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Find Usages command failed', error);
            vscode.window.showErrorMessage(`Find usages failed: ${message}`);
        }
    }

    private async showSearchStrategyOptions(selectedText: string): Promise<string | undefined> {
        const options = [
            {
                label: '🔍 Find Exact Matches',
                description: 'Search for exact code patterns using OpenRewrite find recipes',
                detail: 'Fast text-based search across all repositories',
                searchType: 'find'
            },
            {
                label: '🧠 Semantic Search',
                description: 'Type-aware search considering inheritance and overrides',
                detail: 'Slower but more intelligent search using AST analysis',
                searchType: 'semantic'
            },
            {
                label: '📝 Pattern Search',
                description: 'Regular expression and pattern-based search',
                detail: 'Flexible pattern matching with support for wildcards',
                searchType: 'pattern'
            }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: `Choose search strategy for "${selectedText}"`,
            matchOnDescription: true,
            matchOnDetail: true
        });

        return selected?.searchType;
    }

    private async executeSearch(searchContext: SearchContext, searchType: string): Promise<void> {
        try {
            this.services.logger.info(`Starting ${searchType} search for: ${searchContext.text}`);

            // Get search service (we'll need to add this to the service registry)
            const searchService = this.services.search;
            if (!searchService) {
                throw new Error('Search service not available');
            }

            // Show repository selection if needed
            const repositories = await this.selectRepositories();
            
            const searchOptions = {
                searchType: searchType as 'find' | 'pattern' | 'semantic',
                repositories,
                includeTests: false,
                caseInsensitive: false,
                maxResults: 1000
            };

            // Execute search with progress
            const results = await searchService.searchAcrossRepositories(searchContext, searchOptions);

            // Display results
            await this.displaySearchResults(results, searchContext.text);

        } catch (error) {
            if (error instanceof Error && error.message === 'Search cancelled by user') {
                vscode.window.showInformationMessage('Search cancelled');
            } else {
                throw error;
            }
        }
    }

    private async selectRepositories(): Promise<string[] | undefined> {
        const config = this.services.config.getConfiguration();
        const allRepos = [
            ...config.multiRepos.localPaths,
            // Add organization repos if needed
        ];

        if (allRepos.length === 0) {
            vscode.window.showWarningMessage(
                'No repositories configured. Please configure repositories in settings.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('moderne.openConfiguration');
                }
            });
            return undefined;
        }

        if (allRepos.length === 1) {
            return allRepos;
        }

        // Show repository selection for multiple repos
        const items = allRepos.map(repo => ({
            label: require('path').basename(repo),
            description: repo,
            picked: true // Select all by default
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select repositories to search (or select all)',
            canPickMany: true,
            matchOnDescription: true
        });

        return selected?.map(item => item.description) || allRepos;
    }

    private async displaySearchResults(results: any[], query: string): Promise<void> {
        if (results.length === 0) {
            vscode.window.showInformationMessage(
                `No usages found for "${query}"`,
                'Try Different Search',
                'Configure Repositories'
            ).then(selection => {
                if (selection === 'Configure Repositories') {
                    vscode.commands.executeCommand('moderne.openConfiguration');
                }
            });
            return;
        }

        // Show results in multiple formats
        const displayOption = await vscode.window.showQuickPick([
            {
                label: '📋 Show in Search Panel',
                description: 'Display results in VSCode search view',
                action: 'panel'
            },
            {
                label: '📁 Open Search Results View',
                description: 'Open dedicated search results tree view',
                action: 'tree'
            },
            {
                label: '📄 Export Results',
                description: 'Export search results to file',
                action: 'export'
            }
        ], {
            placeHolder: `Found ${results.length} results for "${query}"`
        });

        switch (displayOption?.action) {
            case 'panel':
                await this.showInSearchPanel(results, query);
                break;
            case 'tree':
                await this.showInTreeView(results, query);
                break;
            case 'export':
                await this.exportResults(results, query);
                break;
        }

        this.services.logger.info(`Search completed: ${results.length} results found`);
    }

    private async showInSearchPanel(results: any[], query: string): Promise<void> {
        // Use VSCode's built-in search functionality
        vscode.window.showInformationMessage(
            `Found ${results.length} results. Opening search panel integration...`
        );
        
        // This would integrate with VSCode's search panel
        // For now, we'll show a summary
        const summary = results.slice(0, 10).map(result => 
            `${result.repository}/${result.filePath}:${result.line} - ${result.preview}`
        ).join('\n');

        const document = await vscode.workspace.openTextDocument({
            content: `Search Results for "${query}"\n\nFound ${results.length} results:\n\n${summary}`,
            language: 'plaintext'
        });

        await vscode.window.showTextDocument(document);
    }

    private async showInTreeView(results: any[], query: string): Promise<void> {
        // Update search results provider
        const searchResultProvider = (global as any).moderneSearchResultProvider;
        if (searchResultProvider) {
            searchResultProvider.updateSearchResults(results, query);
        }
        
        vscode.window.showInformationMessage(
            `Found ${results.length} results. Opening search results view...`
        );
        
        // Focus on search results view
        await vscode.commands.executeCommand('workbench.view.extension.moderne-search-results');
    }

    private async exportResults(results: any[], query: string): Promise<void> {
        const format = await vscode.window.showQuickPick([
            { label: 'JSON', value: 'json' },
            { label: 'CSV', value: 'csv' },
            { label: 'Markdown', value: 'markdown' }
        ], {
            placeHolder: 'Select export format'
        });

        if (format) {
            // Use search result provider for export
            const searchResultProvider = (global as any).moderneSearchResultProvider;
            if (searchResultProvider) {
                searchResultProvider.updateSearchResults(results, query);
                await searchResultProvider.exportResults(format.value);
            } else {
                vscode.window.showErrorMessage('Search result provider not available');
            }
        }
    }
}