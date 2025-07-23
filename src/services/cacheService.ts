import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import { Logger } from '../utils/logger';

export interface CacheEntry<T = any> {
    key: string;
    value: T;
    timestamp: Date;
    ttl: number; // Time to live in milliseconds
    metadata?: Record<string, any>;
}

export interface CacheOptions {
    ttl?: number; // Default TTL in milliseconds
    maxSize?: number; // Maximum number of entries
    persistToDisk?: boolean;
    namespace?: string;
}

export interface CacheStats {
    hits: number;
    misses: number;
    entries: number;
    memoryUsage: number; // Approximate memory usage in bytes
    diskUsage?: number; // Disk usage in bytes if persisted
}

export interface CacheKey {
    operation: string;
    parameters: Record<string, any>;
    context?: Record<string, any>;
}

export class CacheService {
    private memoryCache = new Map<string, CacheEntry>();
    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        entries: 0,
        memoryUsage: 0
    };
    
    private cleanupTimer?: NodeJS.Timeout;
    private readonly options: Required<CacheOptions>;
    private readonly storageUri: vscode.Uri;

    constructor(
        private logger: Logger,
        options: CacheOptions = {}
    ) {
        this.options = {
            ttl: options.ttl || 5 * 60 * 1000, // 5 minutes default
            maxSize: options.maxSize || 1000,
            persistToDisk: options.persistToDisk ?? true,
            namespace: options.namespace || 'moderne-cli'
        };

        this.storageUri = this.getStorageUri();
        this.initializeCache();
        this.startCleanupTimer();
    }

    private getStorageUri(): vscode.Uri {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            return vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'moderne', 'cache');
        }
        return vscode.Uri.file(path.join(process.cwd(), '.vscode', 'moderne', 'cache'));
    }

    private async initializeCache(): Promise<void> {
        if (this.options.persistToDisk) {
            try {
                await fs.ensureDir(this.storageUri.fsPath);
                await this.loadFromDisk();
            } catch (error) {
                this.logger.warn(`Failed to initialize disk cache: ${error}`);
            }
        }
    }

    private async loadFromDisk(): Promise<void> {
        try {
            const cacheFile = path.join(this.storageUri.fsPath, `${this.options.namespace}.json`);
            
            if (await fs.pathExists(cacheFile)) {
                const data = await fs.readJson(cacheFile);
                
                data.entries.forEach((entry: any) => {
                    const cacheEntry: CacheEntry = {
                        ...entry,
                        timestamp: new Date(entry.timestamp)
                    };
                    
                    // Only load non-expired entries
                    if (!this.isExpired(cacheEntry)) {
                        this.memoryCache.set(entry.key, cacheEntry);
                    }
                });

                this.updateStats();
                this.logger.info(`Loaded ${this.memoryCache.size} cache entries from disk`);
            }
        } catch (error) {
            this.logger.error(`Failed to load cache from disk: ${error}`);
        }
    }

    private async saveToDisk(): Promise<void> {
        if (!this.options.persistToDisk) return;

        try {
            const cacheFile = path.join(this.storageUri.fsPath, `${this.options.namespace}.json`);
            const entries = Array.from(this.memoryCache.values())
                .filter(entry => !this.isExpired(entry));

            const data = {
                namespace: this.options.namespace,
                timestamp: new Date().toISOString(),
                entries
            };

            await fs.writeJson(cacheFile, data, { spaces: 2 });
            this.logger.debug(`Saved ${entries.length} cache entries to disk`);
        } catch (error) {
            this.logger.error(`Failed to save cache to disk: ${error}`);
        }
    }

    private startCleanupTimer(): void {
        // Run cleanup every 10 minutes
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, 10 * 60 * 1000);
    }

    private async cleanup(): Promise<void> {
        const beforeSize = this.memoryCache.size;
        
        // Remove expired entries
        for (const [key, entry] of this.memoryCache.entries()) {
            if (this.isExpired(entry)) {
                this.memoryCache.delete(key);
            }
        }

        // If still over size limit, remove oldest entries
        if (this.memoryCache.size > this.options.maxSize) {
            const sortedEntries = Array.from(this.memoryCache.entries())
                .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());

            const entriesToRemove = sortedEntries.slice(0, this.memoryCache.size - this.options.maxSize);
            entriesToRemove.forEach(([key]) => this.memoryCache.delete(key));
        }

        this.updateStats();
        
        const cleaned = beforeSize - this.memoryCache.size;
        if (cleaned > 0) {
            this.logger.debug(`Cleaned up ${cleaned} cache entries`);
            
            if (this.options.persistToDisk) {
                await this.saveToDisk();
            }
        }
    }

    private isExpired(entry: CacheEntry): boolean {
        const now = Date.now();
        const entryTime = entry.timestamp.getTime();
        return (now - entryTime) > entry.ttl;
    }

    private generateKey(cacheKey: CacheKey): string {
        const keyString = JSON.stringify({
            operation: cacheKey.operation,
            parameters: this.normalizeParameters(cacheKey.parameters),
            context: cacheKey.context || {}
        });
        
        return crypto.createHash('sha256').update(keyString).digest('hex');
    }

    private normalizeParameters(params: Record<string, any>): Record<string, any> {
        const normalized: Record<string, any> = {};
        
        Object.keys(params).sort().forEach(key => {
            const value = params[key];
            if (Array.isArray(value)) {
                normalized[key] = [...value].sort();
            } else if (typeof value === 'object' && value !== null) {
                normalized[key] = this.normalizeParameters(value);
            } else {
                normalized[key] = value;
            }
        });

        return normalized;
    }

    private updateStats(): void {
        this.stats.entries = this.memoryCache.size;
        this.stats.memoryUsage = this.calculateMemoryUsage();
    }

    private calculateMemoryUsage(): number {
        let totalSize = 0;
        
        for (const entry of this.memoryCache.values()) {
            totalSize += JSON.stringify(entry).length * 2; // Rough estimate (UTF-16)
        }
        
        return totalSize;
    }

    // Public API
    async get<T>(cacheKey: CacheKey): Promise<T | null> {
        const key = this.generateKey(cacheKey);
        const entry = this.memoryCache.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        if (this.isExpired(entry)) {
            this.memoryCache.delete(key);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        this.logger.debug(`Cache hit for operation: ${cacheKey.operation}`);
        return entry.value as T;
    }

    async set<T>(
        cacheKey: CacheKey, 
        value: T, 
        ttl?: number,
        metadata?: Record<string, any>
    ): Promise<void> {
        const key = this.generateKey(cacheKey);
        
        const entry: CacheEntry<T> = {
            key,
            value,
            timestamp: new Date(),
            ttl: ttl || this.options.ttl,
            metadata
        };

        this.memoryCache.set(key, entry);
        this.updateStats();

        this.logger.debug(`Cached result for operation: ${cacheKey.operation}`);

        // Persist to disk periodically
        if (this.options.persistToDisk && this.memoryCache.size % 10 === 0) {
            await this.saveToDisk();
        }
    }

    async has(cacheKey: CacheKey): Promise<boolean> {
        const key = this.generateKey(cacheKey);
        const entry = this.memoryCache.get(key);
        
        return entry !== undefined && !this.isExpired(entry);
    }

    async delete(cacheKey: CacheKey): Promise<boolean> {
        const key = this.generateKey(cacheKey);
        const deleted = this.memoryCache.delete(key);
        
        if (deleted) {
            this.updateStats();
        }
        
        return deleted;
    }

    async clear(pattern?: string): Promise<void> {
        if (pattern) {
            const regex = new RegExp(pattern);
            const keysToDelete: string[] = [];
            
            for (const [key, entry] of this.memoryCache.entries()) {
                if (regex.test(entry.key)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => this.memoryCache.delete(key));
            this.logger.info(`Cleared ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
        } else {
            this.memoryCache.clear();
            this.logger.info('Cleared all cache entries');
        }

        this.updateStats();
        
        if (this.options.persistToDisk) {
            await this.saveToDisk();
        }
    }

    getStats(): CacheStats {
        return { ...this.stats };
    }

    async getDetailedStats(): Promise<CacheStats & { diskUsage?: number }> {
        const stats = this.getStats();
        
        if (this.options.persistToDisk) {
            try {
                const cacheFile = path.join(this.storageUri.fsPath, `${this.options.namespace}.json`);
                const stat = await fs.stat(cacheFile);
                stats.diskUsage = stat.size;
            } catch {
                stats.diskUsage = 0;
            }
        }
        
        return stats;
    }

    // Helper methods for common CLI operations
    async getCachedCliResult<T>(
        command: string,
        args: string[],
        options: { cwd?: string; timeout?: number } = {},
        ttl?: number
    ): Promise<T | null> {
        const cacheKey: CacheKey = {
            operation: 'cli-command',
            parameters: {
                command,
                args,
                cwd: options.cwd || process.cwd()
            }
        };

        return this.get<T>(cacheKey);
    }

    async setCachedCliResult<T>(
        command: string,
        args: string[],
        result: T,
        options: { cwd?: string; timeout?: number } = {},
        ttl?: number
    ): Promise<void> {
        const cacheKey: CacheKey = {
            operation: 'cli-command',
            parameters: {
                command,
                args,
                cwd: options.cwd || process.cwd()
            }
        };

        await this.set(cacheKey, result, ttl, {
            command,
            executedAt: new Date().toISOString()
        });
    }

    // Repository analysis caching
    async getCachedRepositoryAnalysis<T>(
        repositoryPath: string,
        analysisType: string,
        ttl?: number
    ): Promise<T | null> {
        const cacheKey: CacheKey = {
            operation: 'repository-analysis',
            parameters: {
                repositoryPath,
                analysisType
            }
        };

        return this.get<T>(cacheKey);
    }

    async setCachedRepositoryAnalysis<T>(
        repositoryPath: string,
        analysisType: string,
        result: T,
        ttl?: number
    ): Promise<void> {
        const cacheKey: CacheKey = {
            operation: 'repository-analysis',
            parameters: {
                repositoryPath,
                analysisType
            }
        };

        await this.set(cacheKey, result, ttl, {
            repositoryPath,
            analysisType,
            analyzedAt: new Date().toISOString()
        });
    }

    // Search result caching
    async getCachedSearchResults<T>(
        searchQuery: string,
        repositories: string[],
        searchType: string,
        ttl?: number
    ): Promise<T | null> {
        const cacheKey: CacheKey = {
            operation: 'search',
            parameters: {
                query: searchQuery,
                repositories: repositories.sort(),
                type: searchType
            }
        };

        return this.get<T>(cacheKey);
    }

    async setCachedSearchResults<T>(
        searchQuery: string,
        repositories: string[],
        searchType: string,
        results: T,
        ttl?: number
    ): Promise<void> {
        const cacheKey: CacheKey = {
            operation: 'search',
            parameters: {
                query: searchQuery,
                repositories: repositories.sort(),
                type: searchType
            }
        };

        await this.set(cacheKey, results, ttl, {
            query: searchQuery,
            repositoryCount: repositories.length,
            searchedAt: new Date().toISOString()
        });
    }

    // Cache invalidation helpers
    async invalidateRepositoryCache(repositoryPath: string): Promise<void> {
        const pattern = `repository-analysis.*${repositoryPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
        await this.clear(pattern);
        this.logger.info(`Invalidated cache for repository: ${repositoryPath}`);
    }

    async invalidateSearchCache(): Promise<void> {
        await this.clear('search.*');
        this.logger.info('Invalidated all search cache entries');
    }

    async dispose(): Promise<void> {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        
        if (this.options.persistToDisk) {
            await this.saveToDisk();
        }
        
        this.memoryCache.clear();
        this.logger.info('Cache service disposed');
    }
}

// Enhanced CLI Service with caching
export class CachedCliService {
    constructor(
        private originalCliService: any,
        private cacheService: CacheService,
        private logger: Logger
    ) {}

    async executeCommand(
        command: string,
        args: string[],
        options: { cwd?: string; timeout?: number } = {},
        useCache = true,
        cacheTtl?: number
    ): Promise<string> {
        if (useCache) {
            // Try to get from cache first
            const cached = await this.cacheService.getCachedCliResult<string>(
                command,
                args,
                options,
                cacheTtl
            );

            if (cached !== null) {
                this.logger.debug(`Using cached result for: ${command} ${args.join(' ')}`);
                return cached;
            }
        }

        // Execute command
        const result = await this.originalCliService.executeCommand(command, args, options);

        if (useCache && this.shouldCache(command, args)) {
            await this.cacheService.setCachedCliResult(
                command,
                args,
                result,
                options,
                cacheTtl
            );
        }

        return result;
    }

    private shouldCache(command: string, args: string[]): boolean {
        // Don't cache commands that modify state
        const nonCacheableCommands = ['run', 'apply', 'fix'];
        const nonCacheableArgs = ['--apply', '--fix', '--write'];

        if (nonCacheableCommands.includes(args[0])) {
            return false;
        }

        if (args.some(arg => nonCacheableArgs.includes(arg))) {
            return false;
        }

        return true;
    }

    // Delegate other methods to original service
    async checkVersion(): Promise<string> {
        return this.originalCliService.checkVersion();
    }

    async validateLicense(): Promise<boolean> {
        return this.originalCliService.validateLicense();
    }
}