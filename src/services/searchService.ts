import * as vscode from 'vscode';
import * as path from 'path';
import { CliService } from './cliService';
import { RepositoryService } from './repositoryService';
import { ConfigService } from './configService';
import { Logger } from '../utils/logger';

export interface SearchContext {
    text: string;
    filePath: string;
    language: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
}

export interface SearchResult {
    repository: string;
    filePath: string;
    line: number;
    column: number;
    preview: string;
    context: string;
    matchType: 'exact' | 'similar' | 'pattern' | 'semantic';
}

export interface SearchOptions {
    repositories?: string[];
    includeTests?: boolean;
    caseInsensitive?: boolean;
    maxResults?: number;
    searchType: 'find' | 'pattern' | 'semantic';
}

export class SearchService {
    protected cliService: CliService;
    protected repositoryService: RepositoryService;
    protected configService: ConfigService;
    protected logger: Logger;

    constructor(
        cliService: CliService,
        repositoryService: RepositoryService,
        configService: ConfigService,
        logger: Logger
    ) {
        this.cliService = cliService;
        this.repositoryService = repositoryService;
        this.configService = configService;
        this.logger = logger;
    }

    /**
     * Search for code patterns across multiple repositories
     */
    async searchAcrossRepositories(
        context: SearchContext,
        options: SearchOptions = { searchType: 'find' }
    ): Promise<SearchResult[]> {
        try {
            this.logger.info(`Starting multi-repo search for: ${context.text}`);
            
            const repositories = options.repositories || this.getSearchRepositories();
            const results: SearchResult[] = [];

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Searching across repositories',
                cancellable: true
            }, async (progress, token) => {
                const totalRepos = repositories.length;
                
                for (let i = 0; i < repositories.length; i++) {
                    if (token.isCancellationRequested) {
                        throw new Error('Search cancelled by user');
                    }

                    const repo = repositories[i];
                    progress.report({
                        increment: (100 / totalRepos),
                        message: `Searching ${path.basename(repo)}...`
                    });

                    try {
                        const repoResults = await this.searchInRepository(repo, context, options);
                        results.push(...repoResults);
                    } catch (error) {
                        this.logger.warn(`Search failed in repository ${repo}`, error);
                    }
                }
            });

            this.logger.info(`Multi-repo search completed. Found ${results.length} results.`);
            return results;

        } catch (error) {
            this.logger.error('Multi-repo search failed', error);
            throw error;
        }
    }

    /**
     * Search within a specific repository
     */
    private async searchInRepository(
        repositoryPath: string,
        context: SearchContext,
        options: SearchOptions
    ): Promise<SearchResult[]> {
        const results: SearchResult[] = [];

        try {
            switch (options.searchType) {
                case 'find':
                    return await this.executeFindSearch(repositoryPath, context, options);
                case 'pattern':
                    return await this.executePatternSearch(repositoryPath, context, options);
                case 'semantic':
                    return await this.executeSemanticSearch(repositoryPath, context, options);
                default:
                    return await this.executeFindSearch(repositoryPath, context, options);
            }
        } catch (error) {
            this.logger.warn(`Search failed in ${repositoryPath}`, error);
            return [];
        }
    }

    /**
     * Execute find-based search using OpenRewrite find recipes
     */
    private async executeFindSearch(
        repositoryPath: string,
        context: SearchContext,
        options: SearchOptions
    ): Promise<SearchResult[]> {
        const findRecipe = this.generateFindRecipe(context, options);
        const tempRecipeFile = await this.writeTempRecipe(findRecipe);

        try {
            const args = [
                'run',
                repositoryPath,
                '--recipe-path',
                tempRecipeFile,
                '--dry-run'
            ];

            if (!options.includeTests) {
                args.push('--exclude-patterns', '**/test/**,**/tests/**');
            }

            const result = await this.cliService.executeCommand(args, {
                cwd: repositoryPath,
                timeout: 60000 // 1 minute per repository
            });

            if (result.success && result.data) {
                return this.parseSearchResults(repositoryPath, result.data);
            }

            return [];
        } finally {
            // Clean up temp file
            await this.cleanupTempFile(tempRecipeFile);
        }
    }

    /**
     * Execute pattern-based search
     */
    private async executePatternSearch(
        repositoryPath: string,
        context: SearchContext,
        options: SearchOptions
    ): Promise<SearchResult[]> {
        // For pattern search, we'll use grep-like functionality with CLI
        const args = [
            'search',
            '--pattern',
            context.text,
            '--repository',
            repositoryPath
        ];

        if (options.caseInsensitive) {
            args.push('--case-insensitive');
        }

        if (options.maxResults) {
            args.push('--max-results', options.maxResults.toString());
        }

        const result = await this.cliService.executeCommand(args, {
            cwd: repositoryPath,
            timeout: 30000
        });

        if (result.success && result.data) {
            return this.parseSearchResults(repositoryPath, result.data);
        }

        return [];
    }

    /**
     * Execute semantic search using AST analysis
     */
    private async executeSemanticSearch(
        repositoryPath: string,
        context: SearchContext,
        options: SearchOptions
    ): Promise<SearchResult[]> {
        // Semantic search uses OpenRewrite's type-aware search capabilities
        const semanticRecipe = this.generateSemanticSearchRecipe(context, options);
        const tempRecipeFile = await this.writeTempRecipe(semanticRecipe);

        try {
            const args = [
                'run',
                repositoryPath,
                '--recipe-path',
                tempRecipeFile,
                '--dry-run',
                '--verbose'
            ];

            const result = await this.cliService.executeCommand(args, {
                cwd: repositoryPath,
                timeout: 120000 // 2 minutes for semantic analysis
            });

            if (result.success && result.data) {
                return this.parseSemanticSearchResults(repositoryPath, result.data);
            }

            return [];
        } finally {
            await this.cleanupTempFile(tempRecipeFile);
        }
    }

    /**
     * Generate OpenRewrite find recipe for search
     */
    private generateFindRecipe(context: SearchContext, options: SearchOptions): string {
        const recipeClass = this.getSearchRecipeForContext(context);
        
        return `---
type: specs.openrewrite.org/v1beta/recipe
name: com.moderne.search.FindPattern
displayName: Find Pattern Search
description: Search for specific code patterns
recipeList:
  - ${recipeClass}:
      pattern: "${this.escapePattern(context.text)}"
      caseSensitive: ${!options.caseInsensitive}
`;
    }

    /**
     * Generate semantic search recipe
     */
    private generateSemanticSearchRecipe(context: SearchContext, options: SearchOptions): string {
        return `---
type: specs.openrewrite.org/v1beta/recipe
name: com.moderne.search.SemanticSearch
displayName: Semantic Search
description: Type-aware semantic search
recipeList:
  - org.openrewrite.java.search.FindMethods:
      methodPattern: "*${context.text}*(..)"
  - org.openrewrite.java.search.FindFields:
      fieldPattern: "*${context.text}*"
  - org.openrewrite.java.search.FindTypes:
      fullyQualifiedTypeName: "*${context.text}*"
`;
    }

    /**
     * Get appropriate search recipe based on context
     */
    private getSearchRecipeForContext(context: SearchContext): string {
        switch (context.language) {
            case 'java':
                if (context.text.includes('(')) {
                    return 'org.openrewrite.java.search.FindMethods';
                } else if (context.text.includes('.')) {
                    return 'org.openrewrite.java.search.FindFieldUsages';
                } else {
                    return 'org.openrewrite.java.search.FindTypes';
                }
            case 'xml':
                return 'org.openrewrite.xml.search.FindTags';
            case 'yaml':
                return 'org.openrewrite.yaml.search.FindProperty';
            default:
                return 'org.openrewrite.text.Find';
        }
    }

    /**
     * Parse CLI search results into structured format
     */
    private parseSearchResults(repositoryPath: string, output: any): SearchResult[] {
        const results: SearchResult[] = [];

        try {
            // Parse CLI output format (JSON or structured text)
            const lines = typeof output === 'string' ? output.split('\n') : [];
            
            for (const line of lines) {
                if (line.trim() && !line.startsWith('#')) {
                    const match = this.parseSearchResultLine(line, repositoryPath);
                    if (match) {
                        results.push(match);
                    }
                }
            }
        } catch (error) {
            this.logger.warn('Failed to parse search results', error);
        }

        return results;
    }

    /**
     * Parse semantic search results with type information
     */
    private parseSemanticSearchResults(repositoryPath: string, output: any): SearchResult[] {
        const results: SearchResult[] = [];

        try {
            // Parse semantic search output with type information
            if (typeof output === 'object' && output.results) {
                for (const result of output.results) {
                    results.push({
                        repository: path.basename(repositoryPath),
                        filePath: result.sourcePath,
                        line: result.line || 0,
                        column: result.column || 0,
                        preview: result.preview || '',
                        context: result.context || '',
                        matchType: 'semantic'
                    });
                }
            }
        } catch (error) {
            this.logger.warn('Failed to parse semantic search results', error);
        }

        return results;
    }

    /**
     * Parse individual search result line
     */
    private parseSearchResultLine(line: string, repositoryPath: string): SearchResult | null {
        // Parse different CLI output formats
        const patterns = [
            // Format: file:line:column:preview
            /^([^:]+):(\d+):(\d+):(.+)$/,
            // Format: file:line:preview  
            /^([^:]+):(\d+):(.+)$/,
            // Format: file:preview
            /^([^:]+):(.+)$/
        ];

        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                return {
                    repository: path.basename(repositoryPath),
                    filePath: match[1],
                    line: parseInt(match[2] || '0'),
                    column: parseInt(match[3] || '0'),
                    preview: match[match.length - 1] || '',
                    context: line,
                    matchType: 'exact'
                };
            }
        }

        return null;
    }

    /**
     * Get list of repositories to search
     */
    private getSearchRepositories(): string[] {
        const config = this.configService.getConfiguration();
        const repositories: string[] = [];

        // Add local multi-repo paths
        repositories.push(...config.multiRepos.localPaths);

        // Add organization repositories
        for (const org of config.multiRepos.organizations) {
            const orgRepos = this.repositoryService.getRepositoriesByOrganization(org.id);
            repositories.push(...orgRepos.map(repo => repo.path));
        }

        return repositories.filter(repo => repo && repo.trim().length > 0);
    }

    /**
     * Write temporary recipe file
     */
    private async writeTempRecipe(recipeContent: string): Promise<string> {
        const tempDir = this.configService.getContext().globalStorageUri?.fsPath || '/tmp';
        const tempFile = path.join(tempDir, `moderne-search-${Date.now()}.yml`);
        
        const fs = require('fs-extra');
        await fs.ensureDir(path.dirname(tempFile));
        await fs.writeFile(tempFile, recipeContent);
        
        return tempFile;
    }

    /**
     * Clean up temporary files
     */
    private async cleanupTempFile(filePath: string): Promise<void> {
        try {
            const fs = require('fs-extra');
            await fs.remove(filePath);
        } catch (error) {
            this.logger.warn(`Failed to cleanup temp file ${filePath}`, error);
        }
    }

    /**
     * Escape pattern for recipe usage
     */
    private escapePattern(pattern: string): string {
        return pattern
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    }

    /**
     * Create search context from VSCode selection
     */
    static createSearchContextFromSelection(
        editor: vscode.TextEditor,
        selection?: vscode.Selection
    ): SearchContext {
        const sel = selection || editor.selection;
        const document = editor.document;
        const text = document.getText(sel).trim();

        return {
            text,
            filePath: document.fileName,
            language: document.languageId,
            startLine: sel.start.line,
            endLine: sel.end.line,
            startColumn: sel.start.character,
            endColumn: sel.end.character
        };
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        // Base class dispose - subclasses can override
    }
}