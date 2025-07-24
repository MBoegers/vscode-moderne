import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export interface LazyTreeItem extends vscode.TreeItem {
    id: string;
    parentId?: string;
    hasChildren: boolean;
    isLoaded: boolean;
    loadPriority: 'high' | 'medium' | 'low';
    metadata?: Record<string, any>;
}

export interface LazyLoadRequest {
    itemId: string;
    depth: number;
    maxItems?: number;
    filters?: Record<string, any>;
}

export interface LazyLoadResult<T extends LazyTreeItem> {
    items: T[];
    hasMore: boolean;
    totalCount?: number;
    nextCursor?: string;
}

export interface LazyTreeOptions {
    batchSize: number;
    maxDepth: number;
    loadTimeout: number;
    cacheTimeout: number;
    enableVirtualization: boolean;
    preloadDistance: number; // Number of items to preload ahead
}

export abstract class LazyTreeProvider<T extends LazyTreeItem> implements vscode.TreeDataProvider<T> {
    private loadedItems = new Map<string, T>();
    private childrenCache = new Map<string, T[]>();
    private loadingPromises = new Map<string, Promise<LazyLoadResult<T>>>();
    private lastAccessTime = new Map<string, number>();
    private visibilityTracker = new Map<string, boolean>();
    
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<T | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    protected readonly options: LazyTreeOptions;
    protected disposables: vscode.Disposable[] = [];

    constructor(
        protected logger: Logger,
        options: Partial<LazyTreeOptions> = {}
    ) {
        this.options = {
            batchSize: options.batchSize || 50,
            maxDepth: options.maxDepth || 10,
            loadTimeout: options.loadTimeout || 30000,
            cacheTimeout: options.cacheTimeout || 5 * 60 * 1000, // 5 minutes
            enableVirtualization: options.enableVirtualization ?? true,
            preloadDistance: options.preloadDistance || 10
        };

        this.startCacheCleanup();
        this.setupVisibilityTracking();
    }

    private startCacheCleanup(): void {
        const cleanup = setInterval(() => {
            this.cleanupCache();
        }, this.options.cacheTimeout);

        this.disposables.push(new vscode.Disposable(() => {
            clearInterval(cleanup);
        }));
    }

    private cleanupCache(): void {
        const now = Date.now();
        const expiredKeys: string[] = [];

        for (const [key, lastAccess] of this.lastAccessTime.entries()) {
            if (now - lastAccess > this.options.cacheTimeout) {
                expiredKeys.push(key);
            }
        }

        expiredKeys.forEach(key => {
            this.childrenCache.delete(key);
            this.lastAccessTime.delete(key);
        });

        if (expiredKeys.length > 0) {
            this.logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
        }
    }

    private setupVisibilityTracking(): void {
        // Track which items are visible in the tree view
        if (this.options.enableVirtualization) {
            // This would integrate with VSCode's tree view visibility APIs
            // For now, we'll use a simple approach
        }
    }

    // Abstract methods to be implemented by subclasses
    abstract loadRootItems(request: LazyLoadRequest): Promise<LazyLoadResult<T>>;
    abstract loadChildItems(parentId: string, request: LazyLoadRequest): Promise<LazyLoadResult<T>>;
    abstract createTreeItem(item: T): vscode.TreeItem;

    // VSCode TreeDataProvider implementation
    getTreeItem(element: T): vscode.TreeItem {
        this.trackAccess(element.id);
        return this.createTreeItem(element);
    }

    async getChildren(element?: T): Promise<T[]> {
        try {
            if (!element) {
                // Load root items
                return this.loadItemsWithBatching(null, 0);
            }

            if (!element.hasChildren) {
                return [];
            }

            return this.loadItemsWithBatching(element.id, 1);

        } catch (error) {
            this.logger.error(`Failed to load children: ${error}`);
            return [];
        }
    }

    getParent(element: T): vscode.ProviderResult<T> {
        if (element.parentId) {
            return this.loadedItems.get(element.parentId);
        }
        return null;
    }

    private async loadItemsWithBatching(parentId: string | null, depth: number): Promise<T[]> {
        const cacheKey = parentId || 'root';
        
        // Check cache first
        const cached = this.childrenCache.get(cacheKey);
        if (cached) {
            this.trackAccess(cacheKey);
            return cached;
        }

        // Check if already loading
        let loadingPromise = this.loadingPromises.get(cacheKey);
        if (!loadingPromise) {
            loadingPromise = this.loadItemsBatch(parentId, depth);
            this.loadingPromises.set(cacheKey, loadingPromise);
        }

        try {
            const result = await loadingPromise;
            const items = result.items;

            // Cache the results
            this.childrenCache.set(cacheKey, items);
            this.trackAccess(cacheKey);

            // Store loaded items
            items.forEach(item => {
                this.loadedItems.set(item.id, item);
                item.isLoaded = true;
            });

            // Preload high-priority items
            this.preloadHighPriorityItems(items);

            return items;

        } finally {
            this.loadingPromises.delete(cacheKey);
        }
    }

    private async loadItemsBatch(parentId: string | null, depth: number): Promise<LazyLoadResult<T>> {
        const request: LazyLoadRequest = {
            itemId: parentId || 'root',
            depth,
            maxItems: this.options.batchSize
        };

        if (parentId === null) {
            return this.loadRootItems(request);
        } else {
            return this.loadChildItems(parentId, request);
        }
    }

    private preloadHighPriorityItems(items: T[]): void {
        const highPriorityItems = items
            .filter(item => item.loadPriority === 'high' && item.hasChildren)
            .slice(0, this.options.preloadDistance);

        highPriorityItems.forEach(item => {
            // Load children in background
            this.loadItemsWithBatching(item.id, 2).catch(error => {
                this.logger.debug(`Preload failed for ${item.id}: ${error}`);
            });
        });
    }

    private trackAccess(itemId: string): void {
        this.lastAccessTime.set(itemId, Date.now());
    }

    // Public API for lazy loading management
    async loadMore(parentId?: string): Promise<void> {
        try {
            const cacheKey = parentId || 'root';
            const existing = this.childrenCache.get(cacheKey) || [];
            
            const request: LazyLoadRequest = {
                itemId: parentId || 'root',
                depth: 1,
                maxItems: this.options.batchSize
            };

            let result: LazyLoadResult<T>;
            if (parentId) {
                result = await this.loadChildItems(parentId, request);
            } else {
                result = await this.loadRootItems(request);
            }

            if (result.items.length > 0) {
                const combined = [...existing, ...result.items];
                this.childrenCache.set(cacheKey, combined);
                
                result.items.forEach(item => {
                    this.loadedItems.set(item.id, item);
                });

                this.refresh(parentId ? this.loadedItems.get(parentId) : undefined);
            }
        } catch (error) {
            this.logger.error(`Failed to load more items: ${error}`);
        }
    }

    async reload(itemId?: string): Promise<void> {
        if (itemId) {
            // Reload specific item
            this.childrenCache.delete(itemId);
            this.lastAccessTime.delete(itemId);
            
            const item = this.loadedItems.get(itemId);
            if (item) {
                item.isLoaded = false;
                this.refresh(item);
            }
        } else {
            // Reload all
            this.childrenCache.clear();
            this.lastAccessTime.clear();
            this.loadedItems.clear();
            this.refresh();
        }
    }

    refresh(item?: T): void {
        this._onDidChangeTreeData.fire(item);
    }

    // Search and filtering
    async search(query: string, maxResults = 100): Promise<T[]> {
        const results: T[] = [];
        const searchLower = query.toLowerCase();

        // Search in loaded items first
        for (const item of this.loadedItems.values()) {
            if (results.length >= maxResults) {break;}
            
            if (this.matchesSearch(item, searchLower)) {
                results.push(item);
            }
        }

        // If we need more results, search in unloaded items
        if (results.length < maxResults) {
            try {
                const additionalResults = await this.searchUnloaded(query, maxResults - results.length);
                results.push(...additionalResults);
            } catch (error) {
                this.logger.warn(`Search in unloaded items failed: ${error}`);
            }
        }

        return results;
    }

    private matchesSearch(item: T, searchLower: string): boolean {
        const label = typeof item.label === 'string' ? item.label : (typeof item.label === 'object' && item.label?.label) || '';
        const description = typeof item.description === 'string' ? item.description : '';
        const tooltip = typeof item.tooltip === 'string' ? item.tooltip : '';

        return label.toLowerCase().includes(searchLower) ||
               description.toLowerCase().includes(searchLower) ||
               tooltip.toLowerCase().includes(searchLower);
    }

    protected async searchUnloaded(query: string, maxResults: number): Promise<T[]> {
        // Subclasses can override this to implement search in unloaded items
        return [];
    }

    // Performance monitoring
    getPerformanceMetrics(): {
        loadedItems: number;
        cachedChildren: number;
        cacheHitRate: number;
        memoryUsage: number;
    } {
        const totalAccesses = Array.from(this.lastAccessTime.values()).length;
        const cacheHits = this.childrenCache.size;
        
        return {
            loadedItems: this.loadedItems.size,
            cachedChildren: this.childrenCache.size,
            cacheHitRate: totalAccesses > 0 ? (cacheHits / totalAccesses) * 100 : 0,
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    private estimateMemoryUsage(): number {
        let size = 0;
        
        // Estimate loaded items size
        for (const item of this.loadedItems.values()) {
            size += JSON.stringify(item).length * 2; // UTF-16 estimate
        }
        
        // Estimate cache size
        for (const children of this.childrenCache.values()) {
            size += children.length * 100; // Rough estimate per item
        }
        
        return size;
    }

    // Batch operations
    async loadItemsByIds(ids: string[]): Promise<Map<string, T>> {
        const result = new Map<string, T>();
        const unloadedIds: string[] = [];

        // Check what's already loaded
        for (const id of ids) {
            const item = this.loadedItems.get(id);
            if (item) {
                result.set(id, item);
            } else {
                unloadedIds.push(id);
            }
        }

        // Load remaining items in batches
        if (unloadedIds.length > 0) {
            const batches = this.createBatches(unloadedIds, this.options.batchSize);
            
            for (const batch of batches) {
                try {
                    const batchResults = await this.loadItemsBatch(batch[0], 1);
                    batchResults.items.forEach(item => {
                        if (batch.includes(item.id)) {
                            result.set(item.id, item);
                            this.loadedItems.set(item.id, item);
                        }
                    });
                } catch (error) {
                    this.logger.warn(`Failed to load batch: ${error}`);
                }
            }
        }

        return result;
    }

    private createBatches<U>(items: U[], batchSize: number): U[][] {
        const batches: U[][] = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    // Visibility optimization
    setVisibleRange(startIndex: number, endIndex: number): void {
        if (!this.options.enableVirtualization) {return;}

        // Mark items in visible range
        const allItems = Array.from(this.loadedItems.values());
        for (let i = 0; i < allItems.length; i++) {
            const isVisible = i >= startIndex && i <= endIndex;
            this.visibilityTracker.set(allItems[i].id, isVisible);
        }

        // Preload items near visible range
        const preloadStart = Math.max(0, startIndex - this.options.preloadDistance);
        const preloadEnd = Math.min(allItems.length, endIndex + this.options.preloadDistance);
        
        for (let i = preloadStart; i < preloadEnd; i++) {
            const item = allItems[i];
            if (item && item.hasChildren && !this.childrenCache.has(item.id)) {
                this.loadItemsWithBatching(item.id, 2).catch(error => {
                    this.logger.debug(`Preload failed for visible item ${item.id}: ${error}`);
                });
            }
        }
    }

    // Advanced filtering
    async applyFilter(filter: (item: T) => boolean): Promise<void> {
        const filteredCache = new Map<string, T[]>();
        
        for (const [key, items] of this.childrenCache.entries()) {
            const filtered = items.filter(filter);
            if (filtered.length > 0) {
                filteredCache.set(key, filtered);
            }
        }
        
        this.childrenCache = filteredCache;
        this.refresh();
    }

    clearFilter(): void {
        this.childrenCache.clear();
        this.refresh();
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this._onDidChangeTreeData.dispose();
        
        this.loadedItems.clear();
        this.childrenCache.clear();
        this.loadingPromises.clear();
        this.lastAccessTime.clear();
        this.visibilityTracker.clear();
    }
}