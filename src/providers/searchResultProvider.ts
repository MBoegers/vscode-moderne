import * as vscode from 'vscode';
import * as path from 'path';
import { SearchResult, SearchService } from '../services/searchService';
import { Logger } from '../utils/logger';

export class SearchResultProvider implements vscode.TreeDataProvider<SearchResultItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SearchResultItem | undefined | null | void> = 
        new vscode.EventEmitter<SearchResultItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SearchResultItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private searchResults: SearchResult[] = [];
    private searchQuery: string = '';
    private groupByRepository: boolean = true;

    constructor(
        private searchService: SearchService,
        private logger: Logger
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SearchResultItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SearchResultItem): Thenable<SearchResultItem[]> {
        if (!element) {
            return Promise.resolve(this.getRootItems());
        }

        if (element instanceof RepositoryGroupItem) {
            return Promise.resolve(this.getResultsForRepository(element.repositoryName));
        }

        return Promise.resolve([]);
    }

    /**
     * Update search results and refresh view
     */
    updateSearchResults(results: SearchResult[], query: string): void {
        this.searchResults = results;
        this.searchQuery = query;
        this.refresh();
    }

    /**
     * Clear search results
     */
    clearResults(): void {
        this.searchResults = [];
        this.searchQuery = '';
        this.refresh();
    }

    /**
     * Toggle grouping by repository
     */
    toggleGrouping(): void {
        this.groupByRepository = !this.groupByRepository;
        this.refresh();
    }

    /**
     * Get root items for tree view
     */
    private getRootItems(): SearchResultItem[] {
        if (this.searchResults.length === 0) {
            if (this.searchQuery) {
                return [new NoResultsItem(this.searchQuery)];
            } else {
                return [new WelcomeSearchItem()];
            }
        }

        if (this.groupByRepository) {
            return this.getGroupedByRepository();
        } else {
            return this.getFlatResults();
        }
    }

    /**
     * Group results by repository
     */
    private getGroupedByRepository(): SearchResultItem[] {
        const repositoryGroups = new Map<string, SearchResult[]>();

        // Group results by repository
        for (const result of this.searchResults) {
            const repo = result.repository;
            if (!repositoryGroups.has(repo)) {
                repositoryGroups.set(repo, []);
            }
            repositoryGroups.get(repo)!.push(result);
        }

        // Create repository group items
        const items: SearchResultItem[] = [];
        for (const [repositoryName, results] of repositoryGroups) {
            items.push(new RepositoryGroupItem(repositoryName, results.length));
        }

        // Sort by repository name
        items.sort((a, b) => {
            if (a instanceof RepositoryGroupItem && b instanceof RepositoryGroupItem) {
                return a.repositoryName.localeCompare(b.repositoryName);
            }
            return 0;
        });

        return items;
    }

    /**
     * Get flat list of results
     */
    private getFlatResults(): SearchResultItem[] {
        return this.searchResults.map(result => new SearchResultTreeItem(result));
    }

    /**
     * Get results for specific repository
     */
    private getResultsForRepository(repositoryName: string): SearchResultItem[] {
        return this.searchResults
            .filter(result => result.repository === repositoryName)
            .map(result => new SearchResultTreeItem(result));
    }

    /**
     * Export results to different formats
     */
    async exportResults(format: 'json' | 'csv' | 'markdown'): Promise<void> {
        if (this.searchResults.length === 0) {
            vscode.window.showWarningMessage('No search results to export');
            return;
        }

        const content = this.formatResultsForExport(format);
        const extension = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'md';
        const defaultName = `moderne-search-results-${Date.now()}.${extension}`;

        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultName),
            filters: {
                [format.toUpperCase()]: [extension]
            }
        });

        if (saveUri) {
            const fs = require('fs-extra');
            await fs.writeFile(saveUri.fsPath, content);
            vscode.window.showInformationMessage(`Search results exported to ${saveUri.fsPath}`);
        }
    }

    /**
     * Format results for export
     */
    private formatResultsForExport(format: 'json' | 'csv' | 'markdown'): string {
        switch (format) {
            case 'json':
                return JSON.stringify({
                    query: this.searchQuery,
                    resultCount: this.searchResults.length,
                    timestamp: new Date().toISOString(),
                    results: this.searchResults
                }, null, 2);

            case 'csv':
                const csvHeader = 'Repository,File,Line,Column,Preview,Match Type\n';
                const csvRows = this.searchResults.map(result => 
                    `"${result.repository}","${result.filePath}",${result.line},${result.column},"${result.preview.replace(/"/g, '""')}","${result.matchType}"`
                ).join('\n');
                return csvHeader + csvRows;

            case 'markdown':
                let markdown = `# Search Results for "${this.searchQuery}"\n\n`;
                markdown += `**Found ${this.searchResults.length} results**\n\n`;
                
                const groupedResults = this.searchResults.reduce((groups, result) => {
                    if (!groups[result.repository]) {
                        groups[result.repository] = [];
                    }
                    groups[result.repository].push(result);
                    return groups;
                }, {} as Record<string, SearchResult[]>);

                for (const [repository, results] of Object.entries(groupedResults)) {
                    markdown += `## ${repository} (${results.length} results)\n\n`;
                    for (const result of results) {
                        markdown += `- **${path.basename(result.filePath)}:${result.line}** - ${result.preview}\n`;
                    }
                    markdown += '\n';
                }

                return markdown;

            default:
                return JSON.stringify(this.searchResults, null, 2);
        }
    }
}

abstract class SearchResultItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}

class RepositoryGroupItem extends SearchResultItem {
    constructor(
        public readonly repositoryName: string,
        private readonly resultCount: number
    ) {
        super(`${repositoryName} (${resultCount})`, vscode.TreeItemCollapsibleState.Expanded);
        this.tooltip = `${resultCount} results in ${repositoryName}`;
        this.iconPath = new vscode.ThemeIcon('repo');
        this.contextValue = 'repositoryGroup';
    }
}

class SearchResultTreeItem extends SearchResultItem {
    constructor(private readonly result: SearchResult) {
        super(
            `${path.basename(result.filePath)}:${result.line}`,
            vscode.TreeItemCollapsibleState.None
        );

        this.description = result.preview.length > 50 
            ? result.preview.substring(0, 50) + '...' 
            : result.preview;
        
        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = 'searchResult';
        
        // Command to open file at specific location
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [
                vscode.Uri.file(result.filePath),
                {
                    selection: new vscode.Range(
                        result.line - 1, result.column,
                        result.line - 1, result.column + result.preview.length
                    )
                }
            ]
        };
    }

    private getTooltip(): string {
        const lines = [
            `File: ${this.result.filePath}`,
            `Line: ${this.result.line}, Column: ${this.result.column}`,
            `Match Type: ${this.result.matchType}`,
            `Preview: ${this.result.preview}`
        ];

        if (this.result.context) {
            lines.push(`Context: ${this.result.context}`);
        }

        return lines.join('\n');
    }

    private getIcon(): vscode.ThemeIcon {
        const extension = path.extname(this.result.filePath).toLowerCase();
        
        switch (extension) {
            case '.java':
                return new vscode.ThemeIcon('symbol-class', new vscode.ThemeColor('symbolIcon.classForeground'));
            case '.xml':
                return new vscode.ThemeIcon('symbol-file', new vscode.ThemeColor('symbolIcon.fileForeground'));
            case '.yml':
            case '.yaml':
                return new vscode.ThemeIcon('symbol-property', new vscode.ThemeColor('symbolIcon.propertyForeground'));
            case '.json':
                return new vscode.ThemeIcon('json', new vscode.ThemeColor('symbolIcon.fileForeground'));
            default:
                return new vscode.ThemeIcon('file-code');
        }
    }
}

class NoResultsItem extends SearchResultItem {
    constructor(query: string) {
        super(`No results found for "${query}"`, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('search-stop');
        this.contextValue = 'noResults';
        this.tooltip = `No matches found for search query: ${query}`;
    }
}

class WelcomeSearchItem extends SearchResultItem {
    constructor() {
        super('No search performed yet', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('search');
        this.contextValue = 'welcomeSearch';
        this.tooltip = 'Select code and use "Find Usages on All Repos" to start searching';
    }
}