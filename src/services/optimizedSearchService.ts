import * as vscode from 'vscode';
import { SearchService, SearchContext, SearchResult, SearchOptions } from './searchService';
import { CacheService } from './cacheService';
import { Logger } from '../utils/logger';

export interface SearchResultPage {
    results: SearchResult[];
    totalCount: number;
    hasMore: boolean;
    nextCursor?: string;
    executionTime: number;
}

export interface SearchMemoryManager {
    maxResults: number;
    maxMemoryMB: number;
    compressionThreshold: number;
    enableCompression: boolean;
}

export interface SearchPerformanceMetrics {
    totalSearches: number;
    averageSearchTime: number;
    cacheHitRate: number;
    memoryUsage: number;
    resultsCompressed: number;
    backgroundTasksActive: number;
}

export interface SearchResultChunk {
    id: string;
    results: SearchResult[];
    compressed: boolean;
    timestamp: Date;
    accessCount: number;
    size: number;
}

export class OptimizedSearchService extends SearchService {
    private resultChunks = new Map<string, SearchResultChunk>();
    private searchCache = new Map<string, SearchResultPage>();
    private activeSearches = new Map<string, Promise<SearchResultPage>>();
    private backgroundTasks = new Set<Promise<void>>();
    private memoryManager: SearchMemoryManager;
    private performanceMetrics: SearchPerformanceMetrics;

    private readonly _onDidUpdateMetrics = new vscode.EventEmitter<SearchPerformanceMetrics>();
    readonly onDidUpdateMetrics = this._onDidUpdateMetrics.event;

    constructor(
        cliService: any,
        repositoryService: any,
        configService: any,
        logger: Logger,
        private cacheService: CacheService,
        memoryOptions: Partial<SearchMemoryManager> = {}
    ) {
        super(cliService, repositoryService, configService, logger);

        this.memoryManager = {
            maxResults: memoryOptions.maxResults || 10000,
            maxMemoryMB: memoryOptions.maxMemoryMB || 100,
            compressionThreshold: memoryOptions.compressionThreshold || 1000,
            enableCompression: memoryOptions.enableCompression ?? true
        };

        this.performanceMetrics = {
            totalSearches: 0,
            averageSearchTime: 0,
            cacheHitRate: 0,
            memoryUsage: 0,
            resultsCompressed: 0,
            backgroundTasksActive: 0
        };

        this.startMemoryMonitoring();
    }

    private startMemoryMonitoring(): void {
        setInterval(() => {
            this.updateMemoryMetrics();
            this.performMemoryCleanup();
        }, 30000); // Every 30 seconds
    }

    private updateMemoryMetrics(): void {
        let totalMemory = 0;
        let compressedCount = 0;

        for (const chunk of this.resultChunks.values()) {
            totalMemory += chunk.size;
            if (chunk.compressed) {
                compressedCount++;
            }
        }

        this.performanceMetrics.memoryUsage = totalMemory / (1024 * 1024); // Convert to MB
        this.performanceMetrics.resultsCompressed = compressedCount;
        this.performanceMetrics.backgroundTasksActive = this.backgroundTasks.size;

        this._onDidUpdateMetrics.fire(this.performanceMetrics);
    }

    private async performMemoryCleanup(): Promise<void> {
        const currentMemoryMB = this.performanceMetrics.memoryUsage;
        
        if (currentMemoryMB > this.memoryManager.maxMemoryMB) {
            this.logger.info(`Memory usage (${currentMemoryMB}MB) exceeds limit, starting cleanup`);
            
            // Sort chunks by access frequency and age
            const chunks = Array.from(this.resultChunks.entries())
                .sort(([,a], [,b]) => {
                    const scoreA = this.calculateCleanupScore(a);
                    const scoreB = this.calculateCleanupScore(b);
                    return scoreA - scoreB;
                });

            // Remove least valuable chunks
            let freedMemory = 0;
            for (const [id, chunk] of chunks) {
                this.resultChunks.delete(id);
                freedMemory += chunk.size;
                
                if (currentMemoryMB - (freedMemory / (1024 * 1024)) <= this.memoryManager.maxMemoryMB * 0.8) {
                    break;
                }
            }

            this.logger.info(`Freed ${freedMemory / (1024 * 1024)}MB of memory`);
        }

        // Compress large chunks if needed
        if (this.memoryManager.enableCompression) {
            await this.compressLargeChunks();
        }
    }

    private calculateCleanupScore(chunk: SearchResultChunk): number {
        const age = Date.now() - chunk.timestamp.getTime();
        const ageScore = age / (1000 * 60 * 60); // Hours
        const accessScore = chunk.accessCount * 10;
        const sizeScore = chunk.size / 1024; // KB
        
        return ageScore + sizeScore - accessScore;
    }

    private async compressLargeChunks(): Promise<void> {
        const chunksToCompress = Array.from(this.resultChunks.values())
            .filter(chunk => 
                !chunk.compressed && 
                chunk.results.length > this.memoryManager.compressionThreshold
            );

        for (const chunk of chunksToCompress) {
            try {
                const compressed = await this.compressChunk(chunk);
                chunk.results = compressed.results;
                chunk.compressed = true;
                chunk.size = compressed.size;
            } catch (error) {
                this.logger.warn(`Failed to compress chunk ${chunk.id}: ${error}`);
            }
        }
    }

    private async compressChunk(chunk: SearchResultChunk): Promise<{ results: SearchResult[]; size: number }> {
        // Simple compression by removing redundant data and using references
        const repositoryMap = new Map<string, number>();
        const fileMap = new Map<string, number>();
        let repoIndex = 0;
        let fileIndex = 0;

        const compressedResults = chunk.results.map(result => {
            // Map repositories to indices
            if (!repositoryMap.has(result.repository)) {
                repositoryMap.set(result.repository, repoIndex++);
            }

            // Map file paths to indices  
            if (!fileMap.has(result.filePath)) {
                fileMap.set(result.filePath, fileIndex++);
            }

            return {
                r: repositoryMap.get(result.repository)!, // repository index
                f: fileMap.get(result.filePath)!,         // file index
                l: result.line,
                c: result.column,
                p: result.preview,
                ctx: result.context,
                mt: result.matchType
            };
        });

        const compressedData = {
            repos: Array.from(repositoryMap.keys()),
            files: Array.from(fileMap.keys()),
            results: compressedResults
        };

        const serialized = JSON.stringify(compressedData);
        return {
            results: this.decompressResults(compressedData),
            size: serialized.length * 2 // UTF-16 estimate
        };
    }

    private decompressResults(compressedData: any): SearchResult[] {
        return compressedData.results.map((compressed: any) => ({
            repository: compressedData.repos[compressed.r],
            filePath: compressedData.files[compressed.f],
            line: compressed.l,
            column: compressed.c,
            preview: compressed.p,
            context: compressed.ctx,
            matchType: compressed.mt
        }));
    }

    // Optimized search with pagination and streaming
    async searchWithPagination(
        context: SearchContext,
        options: SearchOptions & {
            pageSize?: number;
            cursor?: string;
            enableStreaming?: boolean;
        } = {}
    ): Promise<SearchResultPage> {
        const startTime = Date.now();
        const searchKey = this.generateSearchKey(context, options);
        
        // Check for active search
        const activeSearch = this.activeSearches.get(searchKey);
        if (activeSearch) {
            this.logger.debug('Returning active search promise');
            return activeSearch;
        }

        // Check cache
        const cached = await this.getCachedSearch(searchKey);
        if (cached) {
            this.performanceMetrics.cacheHitRate = 
                (this.performanceMetrics.cacheHitRate * this.performanceMetrics.totalSearches + 100) /
                (this.performanceMetrics.totalSearches + 1);
            return cached;
        }

        // Create new search promise
        const searchPromise = this.executeOptimizedSearch(context, options);
        this.activeSearches.set(searchKey, searchPromise);

        try {
            const result = await searchPromise;
            
            // Update metrics
            this.performanceMetrics.totalSearches++;
            const executionTime = Date.now() - startTime;
            this.performanceMetrics.averageSearchTime = 
                (this.performanceMetrics.averageSearchTime * (this.performanceMetrics.totalSearches - 1) + executionTime) /
                this.performanceMetrics.totalSearches;

            // Cache result
            await this.cacheSearchResult(searchKey, result);
            
            // Store in chunks for memory management
            await this.storeResultChunk(searchKey, result.results);

            return result;

        } finally {
            this.activeSearches.delete(searchKey);
        }
    }

    private async executeOptimizedSearch(
        context: SearchContext,
        options: SearchOptions & { pageSize?: number; cursor?: string; enableStreaming?: boolean }
    ): Promise<SearchResultPage> {
        const pageSize = options.pageSize || 100;
        const enableStreaming = options.enableStreaming ?? true;

        if (enableStreaming) {
            return this.executeStreamingSearch(context, options, pageSize);
        } else {
            return this.executeBatchSearch(context, options, pageSize);
        }
    }

    private async executeStreamingSearch(
        context: SearchContext,
        options: SearchOptions,
        pageSize: number
    ): Promise<SearchResultPage> {
        const results: SearchResult[] = [];
        let totalCount = 0;
        let hasMore = false;

        try {
            // Use streaming approach with the CLI
            const command = this.buildSearchCommand(context, options);
            command.push('--format', 'jsonl', '--limit', pageSize.toString());

            const output = await this.cliService.executeCommand('mod', command);
            const lines = output.split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    const result = JSON.parse(line);
                    if (this.isValidSearchResult(result)) {
                        results.push(this.transformSearchResult(result));
                        totalCount++;
                    }
                } catch (error) {
                    this.logger.warn(`Failed to parse search result line: ${error}`);
                }
            }

            hasMore = results.length === pageSize;

        } catch (error) {
            this.logger.error(`Streaming search failed: ${error}`);
            throw error;
        }

        return {
            results,
            totalCount,
            hasMore,
            executionTime: 0 // Will be calculated by caller
        };
    }

    private async executeBatchSearch(
        context: SearchContext,
        options: SearchOptions,
        pageSize: number
    ): Promise<SearchResultPage> {
        // Fallback to original search method with pagination
        const allResults = await super.searchAcrossRepositories(context, options);
        
        const startIndex = 0; // Would implement cursor-based pagination here
        const pageResults = allResults.slice(startIndex, startIndex + pageSize);
        
        return {
            results: pageResults,
            totalCount: allResults.length,
            hasMore: startIndex + pageSize < allResults.length,
            executionTime: 0
        };
    }

    private buildSearchCommand(context: SearchContext, options: SearchOptions): string[] {
        const command = ['find'];
        
        if (options.searchType === 'pattern') {
            command.push('--pattern');
        } else if (options.searchType === 'semantic') {
            command.push('--semantic');
        }

        command.push('--query', context.text);
        
        if (options.repositories) {
            options.repositories.forEach(repo => {
                command.push('--repository', repo);
            });
        }

        return command;
    }

    private isValidSearchResult(result: any): boolean {
        return result && 
               typeof result.repository === 'string' &&
               typeof result.filePath === 'string' &&
               typeof result.line === 'number';
    }

    private transformSearchResult(result: any): SearchResult {
        return {
            repository: result.repository,
            filePath: result.filePath,
            line: result.line,
            column: result.column || 0,
            preview: result.preview || '',
            context: result.context || '',
            matchType: result.matchType || 'exact'
        };
    }

    private generateSearchKey(context: SearchContext, options: SearchOptions): string {
        return JSON.stringify({
            text: context.text,
            language: context.language,
            searchType: options.searchType,
            repositories: options.repositories?.sort()
        });
    }

    private async getCachedSearch(searchKey: string): Promise<SearchResultPage | null> {
        return this.cacheService.getCachedSearchResults(
            searchKey,
            [],
            'optimized'
        );
    }

    private async cacheSearchResult(searchKey: string, result: SearchResultPage): Promise<void> {
        await this.cacheService.setCachedSearchResults(
            searchKey,
            [],
            'optimized',
            result,
            5 * 60 * 1000 // 5 minutes TTL
        );
    }

    private async storeResultChunk(searchKey: string, results: SearchResult[]): Promise<void> {
        const chunk: SearchResultChunk = {
            id: searchKey,
            results,
            compressed: false,
            timestamp: new Date(),
            accessCount: 1,
            size: JSON.stringify(results).length * 2
        };

        this.resultChunks.set(searchKey, chunk);

        // Trigger background compression if needed
        if (results.length > this.memoryManager.compressionThreshold) {
            const compressionTask = this.compressChunk(chunk).then(compressed => {
                chunk.results = compressed.results;
                chunk.compressed = true;
                chunk.size = compressed.size;
            });
            
            this.backgroundTasks.add(compressionTask);
            compressionTask.finally(() => {
                this.backgroundTasks.delete(compressionTask);
            });
        }
    }

    // Enhanced search with autocomplete and suggestions
    async searchWithSuggestions(
        query: string,
        maxSuggestions = 10
    ): Promise<{ suggestions: string[]; results: SearchResult[] }> {
        const suggestions: string[] = [];
        
        // Generate suggestions based on search history and common patterns
        const historySuggestions = await this.getSearchHistorySuggestions(query);
        const patternSuggestions = await this.getPatternSuggestions(query);
        
        suggestions.push(...historySuggestions, ...patternSuggestions);
        
        // Perform search if query is complete enough
        let results: SearchResult[] = [];
        if (query.length >= 3) {
            const context: SearchContext = {
                text: query,
                filePath: '',
                language: 'java',
                startLine: 0,
                endLine: 0,
                startColumn: 0,
                endColumn: 0
            };

            const searchResult = await this.searchWithPagination(context, { pageSize: 20 });
            results = searchResult.results;
        }

        return {
            suggestions: suggestions.slice(0, maxSuggestions),
            results
        };
    }

    private async getSearchHistorySuggestions(query: string): Promise<string[]> {
        // This would integrate with VSCode's search history
        // For now, return empty array
        return [];
    }

    private async getPatternSuggestions(query: string): Promise<string[]> {
        const patterns = [
            'System.out.println',
            'StringBuilder',
            'ArrayList',
            'HashMap',
            'try-catch',
            'for-loop',
            'if-statement'
        ];

        return patterns.filter(pattern => 
            pattern.toLowerCase().includes(query.toLowerCase())
        );
    }

    // Search result optimization utilities
    async optimizeResults(results: SearchResult[]): Promise<SearchResult[]> {
        // Remove duplicates
        const uniqueResults = this.removeDuplicates(results);
        
        // Rank by relevance
        const rankedResults = this.rankByRelevance(uniqueResults);
        
        // Group by repository for better presentation
        const groupedResults = this.groupByRepository(rankedResults);
        
        return groupedResults;
    }

    private removeDuplicates(results: SearchResult[]): SearchResult[] {
        const seen = new Set<string>();
        return results.filter(result => {
            const key = `${result.repository}:${result.filePath}:${result.line}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    private rankByRelevance(results: SearchResult[]): SearchResult[] {
        return results.sort((a, b) => {
            // Prioritize exact matches
            if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
            if (b.matchType === 'exact' && a.matchType !== 'exact') return 1;
            
            // Prioritize files with more matches
            const aMatches = results.filter(r => r.filePath === a.filePath).length;
            const bMatches = results.filter(r => r.filePath === b.filePath).length;
            
            return bMatches - aMatches;
        });
    }

    private groupByRepository(results: SearchResult[]): SearchResult[] {
        const groups = new Map<string, SearchResult[]>();
        
        results.forEach(result => {
            const repo = result.repository;
            if (!groups.has(repo)) {
                groups.set(repo, []);
            }
            groups.get(repo)!.push(result);
        });

        // Flatten groups while maintaining repository clustering
        const grouped: SearchResult[] = [];
        for (const repoResults of groups.values()) {
            grouped.push(...repoResults);
        }

        return grouped;
    }

    // Public API for performance monitoring
    getPerformanceMetrics(): SearchPerformanceMetrics {
        return { ...this.performanceMetrics };
    }

    async clearCache(): Promise<void> {
        this.searchCache.clear();
        this.resultChunks.clear();
        await this.cacheService.invalidateSearchCache();
        this.logger.info('Search cache cleared');
    }

    dispose(): void {
        super.dispose();
        this._onDidUpdateMetrics.dispose();
        this.clearCache();
    }
}