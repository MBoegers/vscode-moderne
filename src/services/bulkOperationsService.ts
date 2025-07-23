import * as vscode from 'vscode';
import * as path from 'path';
import { CliService } from './cliService';
import { ConfigService } from './configService';
import { WorkflowService } from './workflowService';
import { Logger } from '../utils/logger';

export interface BulkOperation {
    id: string;
    name: string;
    type: 'recipe-application' | 'analysis' | 'migration' | 'validation';
    targets: BulkTarget[];
    configuration: BulkOperationConfig;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    startTime?: Date;
    endTime?: Date;
    results: BulkOperationResult[];
}

export interface BulkTarget {
    id: string;
    type: 'repository' | 'file' | 'package';
    path: string;
    name: string;
    metadata?: Record<string, any>;
}

export interface BulkOperationConfig {
    recipe?: string;
    parallelism: number;
    timeout: number;
    continueOnError: boolean;
    dryRun: boolean;
    filters?: BulkFilter[];
    parameters?: Record<string, any>;
}

export interface BulkFilter {
    type: 'include' | 'exclude';
    pattern: string;
    field: 'path' | 'name' | 'type';
}

export interface BulkOperationResult {
    targetId: string;
    success: boolean;
    output: string;
    error?: string;
    duration: number;
    timestamp: Date;
    changes?: BulkChange[];
}

export interface BulkChange {
    file: string;
    type: 'added' | 'modified' | 'deleted';
    linesAdded: number;
    linesRemoved: number;
    hunks: number;
}

export interface BulkBatch {
    id: string;
    operationId: string;
    targets: BulkTarget[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    results: BulkOperationResult[];
}

export class BulkOperationsService {
    private operations = new Map<string, BulkOperation>();
    private batches = new Map<string, BulkBatch>();
    private readonly _onDidStartOperation = new vscode.EventEmitter<BulkOperation>();
    private readonly _onDidCompleteOperation = new vscode.EventEmitter<BulkOperation>();
    private readonly _onDidUpdateProgress = new vscode.EventEmitter<BulkOperation>();

    readonly onDidStartOperation = this._onDidStartOperation.event;
    readonly onDidCompleteOperation = this._onDidCompleteOperation.event;
    readonly onDidUpdateProgress = this._onDidUpdateProgress.event;

    constructor(
        private cliService: CliService,
        private configService: ConfigService,
        private workflowService: WorkflowService,
        private logger: Logger
    ) {}

    async createBulkOperation(
        name: string,
        type: BulkOperation['type'],
        targets: BulkTarget[],
        config: Partial<BulkOperationConfig> = {}
    ): Promise<BulkOperation> {
        const operation: BulkOperation = {
            id: this.generateOperationId(),
            name,
            type,
            targets: this.applyFilters(targets, config.filters || []),
            configuration: {
                parallelism: config.parallelism || 3,
                timeout: config.timeout || 300000, // 5 minutes default
                continueOnError: config.continueOnError ?? true,
                dryRun: config.dryRun ?? false,
                filters: config.filters || [],
                parameters: config.parameters || {},
                ...config
            },
            status: 'pending',
            progress: 0,
            results: []
        };

        this.operations.set(operation.id, operation);
        this.logger.info(`Created bulk operation: ${name} (${operation.id})`);
        
        return operation;
    }

    async executeBulkOperation(
        operationId: string,
        token?: vscode.CancellationToken
    ): Promise<BulkOperation> {
        const operation = this.operations.get(operationId);
        if (!operation) {
            throw new Error(`Operation not found: ${operationId}`);
        }

        operation.status = 'running';
        operation.startTime = new Date();
        operation.progress = 0;

        this._onDidStartOperation.fire(operation);

        try {
            const batches = this.createBatches(operation);
            
            // Execute batches based on parallelism setting
            if (operation.configuration.parallelism === 1) {
                await this.executeBatchesSequential(operation, batches, token);
            } else {
                await this.executeBatchesParallel(operation, batches, token);
            }

            operation.status = 'completed';
            operation.progress = 100;

        } catch (error) {
            operation.status = 'failed';
            this.logger.error(`Bulk operation failed: ${error}`);
            throw error;
        } finally {
            operation.endTime = new Date();
            this._onDidCompleteOperation.fire(operation);
        }

        return operation;
    }

    private createBatches(operation: BulkOperation): BulkBatch[] {
        const batchSize = Math.max(1, Math.floor(operation.targets.length / operation.configuration.parallelism));
        const batches: BulkBatch[] = [];

        for (let i = 0; i < operation.targets.length; i += batchSize) {
            const batchTargets = operation.targets.slice(i, i + batchSize);
            const batch: BulkBatch = {
                id: `${operation.id}-batch-${batches.length}`,
                operationId: operation.id,
                targets: batchTargets,
                status: 'pending',
                results: []
            };

            batches.push(batch);
            this.batches.set(batch.id, batch);
        }

        return batches;
    }

    private async executeBatchesSequential(
        operation: BulkOperation,
        batches: BulkBatch[],
        token?: vscode.CancellationToken
    ): Promise<void> {
        for (let i = 0; i < batches.length; i++) {
            if (token?.isCancellationRequested) {
                operation.status = 'cancelled';
                break;
            }

            const batch = batches[i];
            await this.executeBatch(batch, operation);
            
            // Update overall progress
            operation.progress = ((i + 1) / batches.length) * 100;
            operation.results.push(...batch.results);
            
            this._onDidUpdateProgress.fire(operation);
        }
    }

    private async executeBatchesParallel(
        operation: BulkOperation,
        batches: BulkBatch[],
        token?: vscode.CancellationToken
    ): Promise<void> {
        const batchPromises = batches.map(batch => 
            this.executeBatch(batch, operation, token)
        );

        const results = await Promise.allSettled(batchPromises);
        
        // Collect all results
        batches.forEach(batch => {
            operation.results.push(...batch.results);
        });

        // Check for failures
        const failures = results.filter(result => result.status === 'rejected');
        if (failures.length > 0 && !operation.configuration.continueOnError) {
            throw new Error(`${failures.length} batches failed`);
        }
    }

    private async executeBatch(
        batch: BulkBatch,
        operation: BulkOperation,
        token?: vscode.CancellationToken
    ): Promise<void> {
        batch.status = 'running';
        batch.startTime = new Date();

        try {
            for (const target of batch.targets) {
                if (token?.isCancellationRequested) {
                    batch.status = 'failed';
                    return;
                }

                const result = await this.executeOnTarget(target, operation);
                batch.results.push(result);
            }

            batch.status = 'completed';
        } catch (error) {
            batch.status = 'failed';
            this.logger.error(`Batch execution failed: ${error}`);
            throw error;
        } finally {
            batch.endTime = new Date();
        }
    }

    private async executeOnTarget(
        target: BulkTarget,
        operation: BulkOperation
    ): Promise<BulkOperationResult> {
        const startTime = Date.now();
        const result: BulkOperationResult = {
            targetId: target.id,
            success: false,
            output: '',
            duration: 0,
            timestamp: new Date()
        };

        try {
            this.logger.debug(`Executing ${operation.type} on target: ${target.path}`);

            switch (operation.type) {
                case 'recipe-application':
                    result.output = await this.applyRecipeToTarget(target, operation);
                    break;
                case 'analysis':
                    result.output = await this.analyzeTarget(target, operation);
                    break;
                case 'validation':
                    result.output = await this.validateTarget(target, operation);
                    break;
                case 'migration':
                    result.output = await this.migrateTarget(target, operation);
                    break;
                default:
                    throw new Error(`Unsupported operation type: ${operation.type}`);
            }

            result.success = true;
            result.changes = await this.extractChanges(result.output);

        } catch (error) {
            result.error = error instanceof Error ? error.message : String(error);
            this.logger.error(`Target execution failed: ${result.error}`);
        }

        result.duration = Date.now() - startTime;
        return result;
    }

    private async applyRecipeToTarget(
        target: BulkTarget,
        operation: BulkOperation
    ): Promise<string> {
        if (!operation.configuration.recipe) {
            throw new Error('Recipe not specified for recipe application');
        }

        const args = [
            'run',
            '--recipe', operation.configuration.recipe,
            target.path
        ];

        if (operation.configuration.dryRun) {
            args.push('--dry-run');
        }

        // Add custom parameters
        Object.entries(operation.configuration.parameters || {}).forEach(([key, value]) => {
            args.push(`--${key}`, String(value));
        });

        return await this.cliService.executeCommand('mod', args, {
            timeout: operation.configuration.timeout,
            cwd: path.dirname(target.path)
        });
    }

    private async analyzeTarget(
        target: BulkTarget,
        operation: BulkOperation
    ): Promise<string> {
        const args = [
            'study',
            target.path,
            '--format', 'json'
        ];

        // Add analysis scope parameters
        Object.entries(operation.configuration.parameters || {}).forEach(([key, value]) => {
            if (key === 'scope') {
                args.push('--scope', String(value));
            }
        });

        return await this.cliService.executeCommand('mod', args, {
            timeout: operation.configuration.timeout,
            cwd: path.dirname(target.path)
        });
    }

    private async validateTarget(
        target: BulkTarget,
        operation: BulkOperation
    ): Promise<string> {
        const args = [
            'build',
            '--validate',
            target.path
        ];

        return await this.cliService.executeCommand('mod', args, {
            timeout: operation.configuration.timeout,
            cwd: path.dirname(target.path)
        });
    }

    private async migrateTarget(
        target: BulkTarget,
        operation: BulkOperation
    ): Promise<string> {
        // Use workflow service for complex migration
        const workflowExecution = await this.workflowService.executeWorkflow(
            'bulk-modernization',
            {
                repositories: [target.path],
                activeRecipe: operation.configuration.recipe,
                variables: operation.configuration.parameters
            }
        );

        return workflowExecution.results
            .map(result => result.output)
            .join('\n');
    }

    private async extractChanges(output: string): Promise<BulkChange[]> {
        const changes: BulkChange[] = [];
        
        // Parse CLI output for file changes
        // This is a simplified implementation - real parsing would be more robust
        const lines = output.split('\n');
        
        for (const line of lines) {
            if (line.includes('Modified:') || line.includes('Changed:')) {
                const match = line.match(/([A-Z][a-z]+):\s+(.+)/);
                if (match) {
                    changes.push({
                        file: match[2],
                        type: 'modified',
                        linesAdded: 0, // Would need to parse diff output
                        linesRemoved: 0,
                        hunks: 1
                    });
                }
            }
        }

        return changes;
    }

    private applyFilters(targets: BulkTarget[], filters: BulkFilter[]): BulkTarget[] {
        return targets.filter(target => {
            return filters.every(filter => {
                const value = this.getFilterValue(target, filter.field);
                const matches = this.matchesPattern(value, filter.pattern);
                
                return filter.type === 'include' ? matches : !matches;
            });
        });
    }

    private getFilterValue(target: BulkTarget, field: BulkFilter['field']): string {
        switch (field) {
            case 'path': return target.path;
            case 'name': return target.name;
            case 'type': return target.type;
            default: return '';
        }
    }

    private matchesPattern(value: string, pattern: string): boolean {
        // Simple glob-style pattern matching
        const regex = new RegExp(
            pattern
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.')
        );
        return regex.test(value);
    }

    private generateOperationId(): string {
        return `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public API methods
    getOperation(id: string): BulkOperation | undefined {
        return this.operations.get(id);
    }

    getOperations(): BulkOperation[] {
        return Array.from(this.operations.values());
    }

    getActiveOperations(): BulkOperation[] {
        return Array.from(this.operations.values())
            .filter(op => op.status === 'running');
    }

    async cancelOperation(id: string): Promise<void> {
        const operation = this.operations.get(id);
        if (operation && operation.status === 'running') {
            operation.status = 'cancelled';
            operation.endTime = new Date();
            this._onDidCompleteOperation.fire(operation);
        }
    }

    // Convenience methods for common operations
    async bulkApplyRecipe(
        recipePath: string,
        repositoryPaths: string[],
        options: Partial<BulkOperationConfig> = {}
    ): Promise<BulkOperation> {
        const targets: BulkTarget[] = repositoryPaths.map((repoPath, index) => ({
            id: `repo-${index}`,
            type: 'repository',
            path: repoPath,
            name: path.basename(repoPath)
        }));

        const operation = await this.createBulkOperation(
            `Apply Recipe: ${path.basename(recipePath)}`,
            'recipe-application',
            targets,
            {
                recipe: recipePath,
                ...options
            }
        );

        return this.executeBulkOperation(operation.id);
    }

    async bulkAnalyzeRepositories(
        repositoryPaths: string[],
        scope: string = 'all',
        options: Partial<BulkOperationConfig> = {}
    ): Promise<BulkOperation> {
        const targets: BulkTarget[] = repositoryPaths.map((repoPath, index) => ({
            id: `repo-${index}`,
            type: 'repository',
            path: repoPath,
            name: path.basename(repoPath)
        }));

        const operation = await this.createBulkOperation(
            'Repository Analysis',
            'analysis',
            targets,
            {
                parameters: { scope },
                ...options
            }
        );

        return this.executeBulkOperation(operation.id);
    }

    async bulkValidateRecipes(
        recipePaths: string[],
        options: Partial<BulkOperationConfig> = {}
    ): Promise<BulkOperation> {
        const targets: BulkTarget[] = recipePaths.map((recipePath, index) => ({
            id: `recipe-${index}`,
            type: 'file',
            path: recipePath,
            name: path.basename(recipePath)
        }));

        const operation = await this.createBulkOperation(
            'Recipe Validation',
            'validation',
            targets,
            options
        );

        return this.executeBulkOperation(operation.id);
    }

    dispose(): void {
        this._onDidStartOperation.dispose();
        this._onDidCompleteOperation.dispose();
        this._onDidUpdateProgress.dispose();
        this.operations.clear();
        this.batches.clear();
    }
}