import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { RecipeTemplateService } from './recipeTemplateService';
import { PatternDetectionService } from './patternDetectionService';

export interface RecipeNode {
    id: string;
    name: string;
    type: 'recipe' | 'condition' | 'group' | 'parallel' | 'sequence';
    recipe?: string;
    condition?: RecipeCondition;
    children?: RecipeNode[];
    configuration?: RecipeNodeConfiguration;
    metadata?: RecipeNodeMetadata;
}

export interface RecipeCondition {
    type: 'pattern' | 'dependency' | 'framework' | 'language' | 'custom';
    expression: string;
    negate?: boolean;
}

export interface RecipeNodeConfiguration {
    enabled: boolean;
    continueOnError: boolean;
    timeout?: number;
    retries?: number;
    priority?: number;
    parameters?: Record<string, any>;
}

export interface RecipeNodeMetadata {
    description?: string;
    tags?: string[];
    author?: string;
    estimatedTime?: number;
    requiredTools?: string[];
}

export interface RecipeChain {
    id: string;
    name: string;
    description: string;
    version: string;
    rootNode: RecipeNode;
    variables: Record<string, RecipeVariable>;
    preconditions: RecipeCondition[];
    postconditions: RecipeCondition[];
    metadata: RecipeChainMetadata;
}

export interface RecipeVariable {
    name: string;
    type: 'string' | 'boolean' | 'number' | 'array' | 'object';
    description: string;
    defaultValue?: any;
    required: boolean;
    validation?: VariableValidation;
}

export interface VariableValidation {
    pattern?: string;
    minValue?: number;
    maxValue?: number;
    allowedValues?: any[];
    customValidator?: string;
}

export interface RecipeChainMetadata {
    category: string;
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedDuration: number;
    requiredPermissions: string[];
    supportedLanguages: string[];
    supportedFrameworks: string[];
    created: Date;
    lastModified: Date;
    usageCount: number;
    successRate: number;
}

export interface ChainExecutionContext {
    variables: Record<string, any>;
    workspaceRoot: string;
    targetFiles: string[];
    dryRun: boolean;
    continueOnError: boolean;
    currentNode?: string;
    executionHistory: ChainExecutionStep[];
}

export interface ChainExecutionStep {
    nodeId: string;
    nodeName: string;
    startTime: Date;
    endTime?: Date;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    output?: string;
    error?: string;
    conditionResult?: boolean;
}

export interface ChainExecutionResult {
    chainId: string;
    executionId: string;
    status: 'completed' | 'failed' | 'partial';
    startTime: Date;
    endTime: Date;
    context: ChainExecutionContext;
    summary: ExecutionSummary;
}

export interface ExecutionSummary {
    totalNodes: number;
    executedNodes: number;
    successfulNodes: number;
    failedNodes: number;
    skippedNodes: number;
    totalDuration: number;
    filesModified: number;
    warnings: string[];
    errors: string[];
}

export class RecipeCompositionService {
    private chains = new Map<string, RecipeChain>();
    private templates = new Map<string, RecipeChainTemplate>();
    private executionHistory: ChainExecutionResult[] = [];

    private readonly _onDidCreateChain = new vscode.EventEmitter<RecipeChain>();
    private readonly _onDidExecuteChain = new vscode.EventEmitter<ChainExecutionResult>();
    private readonly _onDidUpdateProgress = new vscode.EventEmitter<{ chainId: string; step: ChainExecutionStep }>();

    readonly onDidCreateChain = this._onDidCreateChain.event;
    readonly onDidExecuteChain = this._onDidExecuteChain.event;
    readonly onDidUpdateProgress = this._onDidUpdateProgress.event;

    constructor(
        private recipeTemplateService: RecipeTemplateService,
        private patternDetectionService: PatternDetectionService,
        private logger: Logger
    ) {
        this.initializeBuiltInChains();
        this.initializeChainTemplates();
    }

    private initializeBuiltInChains(): void {
        // Java Modernization Chain
        const javaModernizationChain: RecipeChain = {
            id: 'java-modernization-full',
            name: 'Complete Java Modernization',
            description: 'Comprehensive Java modernization from legacy versions to modern practices',
            version: '1.0.0',
            rootNode: {
                id: 'root',
                name: 'Java Modernization Pipeline',
                type: 'sequence',
                children: [
                    {
                        id: 'version-check',
                        name: 'Check Java Version',
                        type: 'condition',
                        condition: {
                            type: 'language',
                            expression: 'java.version < 11'
                        }
                    },
                    {
                        id: 'dependency-phase',
                        name: 'Dependency Modernization',
                        type: 'parallel',
                        children: [
                            {
                                id: 'update-deps',
                                name: 'Update Dependencies',
                                type: 'recipe',
                                recipe: 'org.openrewrite.java.dependencies.UpgradeDependencyVersion'
                            },
                            {
                                id: 'security-fixes',
                                name: 'Fix Security Vulnerabilities',
                                type: 'recipe',
                                recipe: 'org.openrewrite.java.security.SecureRandom'
                            }
                        ]
                    },
                    {
                        id: 'code-modernization',
                        name: 'Code Pattern Modernization',
                        type: 'sequence',
                        children: [
                            {
                                id: 'java8-patterns',
                                name: 'Java 8 Patterns',
                                type: 'recipe',
                                recipe: 'org.openrewrite.java.migrate.Java8toJava11'
                            },
                            {
                                id: 'string-builder',
                                name: 'StringBuilder Optimization',
                                type: 'recipe',
                                recipe: 'com.example.StringBuilderOptimization'
                            }
                        ]
                    }
                ]
            },
            variables: {
                targetJavaVersion: {
                    name: 'Target Java Version',
                    type: 'string',
                    description: 'Target Java version for modernization',
                    defaultValue: '17',
                    required: true,
                    validation: {
                        allowedValues: ['11', '17', '21']
                    }
                }
            },
            preconditions: [
                {
                    type: 'language',
                    expression: 'java'
                }
            ],
            postconditions: [
                {
                    type: 'custom',
                    expression: 'compilation.successful && tests.passing'
                }
            ],
            metadata: {
                category: 'modernization',
                complexity: 'complex',
                estimatedDuration: 30 * 60 * 1000, // 30 minutes
                requiredPermissions: ['file.write', 'dependency.modify'],
                supportedLanguages: ['java'],
                supportedFrameworks: ['spring', 'junit'],
                created: new Date(),
                lastModified: new Date(),
                usageCount: 0,
                successRate: 0
            }
        };

        // Spring Boot Migration Chain
        const springBootMigrationChain: RecipeChain = {
            id: 'spring-boot-2-to-3-migration',
            name: 'Spring Boot 2 to 3 Migration',
            description: 'Complete migration from Spring Boot 2.x to 3.x',
            version: '1.0.0',
            rootNode: {
                id: 'root',
                name: 'Spring Boot Migration Pipeline',
                type: 'sequence',
                children: [
                    {
                        id: 'pre-migration-checks',
                        name: 'Pre-migration Validation',
                        type: 'group',
                        children: [
                            {
                                id: 'check-spring-version',
                                name: 'Check Spring Boot Version',
                                type: 'condition',
                                condition: {
                                    type: 'dependency',
                                    expression: 'spring-boot.version matches "2\\.*"'
                                }
                            },
                            {
                                id: 'check-java-17',
                                name: 'Ensure Java 17+',
                                type: 'condition',
                                condition: {
                                    type: 'language',
                                    expression: 'java.version >= 17'
                                }
                            }
                        ]
                    },
                    {
                        id: 'core-migration',
                        name: 'Core Spring Boot Migration',
                        type: 'recipe',
                        recipe: 'org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_0'
                    },
                    {
                        id: 'jakarta-migration',
                        name: 'Jakarta EE Migration',
                        type: 'recipe',
                        recipe: 'org.openrewrite.java.migrate.javax.JavaxMigrationToJakarta'
                    },
                    {
                        id: 'security-migration',
                        name: 'Spring Security 6 Migration',
                        type: 'condition',
                        condition: {
                            type: 'dependency',
                            expression: 'spring-security.present'
                        },
                        children: [
                            {
                                id: 'security-config-update',
                                name: 'Update Security Configuration',
                                type: 'recipe',
                                recipe: 'org.openrewrite.java.spring.security6.UpgradeSprinSecurity_6_0'
                            }
                        ]
                    },
                    {
                        id: 'post-migration-cleanup',
                        name: 'Post-migration Cleanup',
                        type: 'parallel',
                        children: [
                            {
                                id: 'update-tests',
                                name: 'Update Test Configuration',
                                type: 'recipe',
                                recipe: 'org.openrewrite.java.spring.boot3.UpdateTestSlices'
                            },
                            {
                                id: 'cleanup-deprecated',
                                name: 'Remove Deprecated APIs',
                                type: 'recipe',
                                recipe: 'org.openrewrite.java.spring.boot3.RemoveDeprecatedApis'
                            }
                        ]
                    }
                ]
            },
            variables: {},
            preconditions: [
                {
                    type: 'framework',
                    expression: 'spring-boot'
                }
            ],
            postconditions: [
                {
                    type: 'dependency',
                    expression: 'spring-boot.version matches "3\\.*"'
                }
            ],
            metadata: {
                category: 'migration',
                complexity: 'complex',
                estimatedDuration: 45 * 60 * 1000, // 45 minutes
                requiredPermissions: ['file.write', 'dependency.modify', 'test.run'],
                supportedLanguages: ['java'],
                supportedFrameworks: ['spring-boot'],
                created: new Date(),
                lastModified: new Date(),
                usageCount: 0,
                successRate: 0
            }
        };

        this.chains.set(javaModernizationChain.id, javaModernizationChain);
        this.chains.set(springBootMigrationChain.id, springBootMigrationChain);

        this.logger.info(`Initialized ${this.chains.size} built-in recipe chains`);
    }

    private initializeChainTemplates(): void {
        // Template for creating custom modernization chains
        const modernizationTemplate: RecipeChainTemplate = {
            id: 'modernization-template',
            name: 'Modernization Chain Template',
            description: 'Template for creating custom modernization chains',
            category: 'modernization',
            structure: {
                phases: ['analysis', 'preparation', 'transformation', 'validation'],
                defaultExecutionMode: 'sequence',
                supportedConditions: ['language', 'framework', 'dependency', 'pattern'],
                commonRecipes: [
                    'dependency-updates',
                    'security-fixes',
                    'pattern-modernization',
                    'code-cleanup'
                ]
            }
        };

        this.templates.set(modernizationTemplate.id, modernizationTemplate);
    }

    // Chain creation and composition
    async createChain(
        name: string,
        description: string,
        rootNode: RecipeNode,
        options: Partial<RecipeChain> = {}
    ): Promise<RecipeChain> {
        const chainId = `chain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const chain: RecipeChain = {
            id: chainId,
            name,
            description,
            version: options.version || '1.0.0',
            rootNode,
            variables: options.variables || {},
            preconditions: options.preconditions || [],
            postconditions: options.postconditions || [],
            metadata: {
                category: options.metadata?.category || 'custom',
                complexity: this.calculateChainComplexity(rootNode),
                estimatedDuration: this.estimateChainDuration(rootNode),
                requiredPermissions: options.metadata?.requiredPermissions || ['file.write'],
                supportedLanguages: options.metadata?.supportedLanguages || [],
                supportedFrameworks: options.metadata?.supportedFrameworks || [],
                created: new Date(),
                lastModified: new Date(),
                usageCount: 0,
                successRate: 0
            }
        };

        this.chains.set(chainId, chain);
        this._onDidCreateChain.fire(chain);

        this.logger.info(`Created recipe chain: ${name} (${chainId})`);
        return chain;
    }

    async createChainFromPatterns(
        patterns: any[], // CodePattern[] from pattern detection
        name: string,
        options: { 
            executionMode?: 'sequence' | 'parallel';
            groupByType?: boolean;
            includeValidation?: boolean;
        } = {}
    ): Promise<RecipeChain> {
        const executionMode = options.executionMode || 'sequence';
        const groupByType = options.groupByType ?? true;
        
        // Group patterns by suggested recipes
        const recipeGroups = new Map<string, any[]>();
        patterns.forEach(pattern => {
            pattern.suggestedRecipes.forEach((recipe: string) => {
                if (!recipeGroups.has(recipe)) {
                    recipeGroups.set(recipe, []);
                }
                recipeGroups.get(recipe)!.push(pattern);
            });
        });

        // Create nodes for each recipe group
        const recipeNodes: RecipeNode[] = [];
        let nodeIndex = 0;

        for (const [recipe, groupPatterns] of recipeGroups.entries()) {
            const node: RecipeNode = {
                id: `pattern-recipe-${nodeIndex++}`,
                name: `Apply ${recipe}`,
                type: 'recipe',
                recipe,
                configuration: {
                    enabled: true,
                    continueOnError: true,
                    priority: this.calculatePatternPriority(groupPatterns)
                },
                metadata: {
                    description: `Address ${groupPatterns.length} instances of patterns`,
                    estimatedTime: groupPatterns.length * 30000, // 30 seconds per pattern
                    tags: ['auto-generated', 'pattern-based']
                }
            };
            recipeNodes.push(node);
        }

        // Add validation step if requested
        if (options.includeValidation) {
            recipeNodes.push({
                id: 'validation-step',
                name: 'Validation',
                type: 'group',
                children: [
                    {
                        id: 'compile-check',
                        name: 'Compilation Check',
                        type: 'condition',
                        condition: {
                            type: 'custom',
                            expression: 'compilation.successful'
                        }
                    },
                    {
                        id: 'test-execution',
                        name: 'Test Execution',
                        type: 'condition',
                        condition: {
                            type: 'custom',
                            expression: 'tests.passing'
                        }
                    }
                ]
            });
        }

        const rootNode: RecipeNode = {
            id: 'pattern-based-root',
            name: 'Pattern-based Modernization',
            type: executionMode,
            children: recipeNodes
        };

        return this.createChain(
            name,
            `Auto-generated chain from ${patterns.length} detected patterns`,
            rootNode,
            {
                metadata: {
                    category: 'pattern-based',
                    supportedLanguages: [...new Set(patterns.map(p => p.metadata.language))],
                    supportedFrameworks: [...new Set(patterns.map(p => p.metadata.framework).filter(Boolean))]
                }
            }
        );
    }

    // Chain execution
    async executeChain(
        chainId: string,
        context: Partial<ChainExecutionContext> = {},
        token?: vscode.CancellationToken
    ): Promise<ChainExecutionResult> {
        const chain = this.chains.get(chainId);
        if (!chain) {
            throw new Error(`Chain not found: ${chainId}`);
        }

        const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const startTime = new Date();

        const executionContext: ChainExecutionContext = {
            variables: { ...context.variables },
            workspaceRoot: context.workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
            targetFiles: context.targetFiles || [],
            dryRun: context.dryRun ?? false,
            continueOnError: context.continueOnError ?? true,
            executionHistory: []
        };

        this.logger.info(`Starting chain execution: ${chain.name} (${executionId})`);

        try {
            // Check preconditions
            await this.checkConditions(chain.preconditions, executionContext);

            // Execute the chain
            await this.executeNode(chain.rootNode, executionContext, token);

            // Check postconditions
            await this.checkConditions(chain.postconditions, executionContext);

            const result: ChainExecutionResult = {
                chainId,
                executionId,
                status: 'completed',
                startTime,
                endTime: new Date(),
                context: executionContext,
                summary: this.generateExecutionSummary(executionContext)
            };

            // Update chain statistics
            chain.metadata.usageCount++;
            chain.metadata.successRate = this.calculateSuccessRate(chain);

            this.executionHistory.push(result);
            this._onDidExecuteChain.fire(result);

            this.logger.info(`Chain execution completed: ${executionId}`);
            return result;

        } catch (error) {
            const result: ChainExecutionResult = {
                chainId,
                executionId,
                status: 'failed',
                startTime,
                endTime: new Date(),
                context: executionContext,
                summary: this.generateExecutionSummary(executionContext)
            };

            result.summary.errors.push(error instanceof Error ? error.message : String(error));
            
            this.executionHistory.push(result);
            this._onDidExecuteChain.fire(result);

            this.logger.error(`Chain execution failed: ${executionId} - ${error}`);
            throw error;
        }
    }

    private async executeNode(
        node: RecipeNode,
        context: ChainExecutionContext,
        token?: vscode.CancellationToken
    ): Promise<void> {
        if (token?.isCancellationRequested) {
            throw new Error('Execution cancelled');
        }

        const step: ChainExecutionStep = {
            nodeId: node.id,
            nodeName: node.name,
            startTime: new Date(),
            status: 'running'
        };

        context.currentNode = node.id;
        context.executionHistory.push(step);
        this._onDidUpdateProgress.fire({ chainId: '', step });

        try {
            switch (node.type) {
                case 'recipe':
                    await this.executeRecipeNode(node, context);
                    break;
                case 'condition':
                    await this.executeConditionNode(node, context, token);
                    break;
                case 'group':
                case 'sequence':
                    await this.executeSequenceNode(node, context, token);
                    break;
                case 'parallel':
                    await this.executeParallelNode(node, context, token);
                    break;
                default:
                    throw new Error(`Unknown node type: ${node.type}`);
            }

            step.status = 'completed';
            step.endTime = new Date();

        } catch (error) {
            step.status = 'failed';
            step.endTime = new Date();
            step.error = error instanceof Error ? error.message : String(error);

            if (!node.configuration?.continueOnError) {
                throw error;
            }
        }
    }

    private async executeRecipeNode(node: RecipeNode, context: ChainExecutionContext): Promise<void> {
        if (!node.recipe) {
            throw new Error(`Recipe not specified for node: ${node.name}`);
        }

        this.logger.info(`Executing recipe: ${node.recipe}`);

        // Here you would integrate with the actual recipe execution system
        // For now, we'll simulate the execution
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update context with results
        const step = context.executionHistory[context.executionHistory.length - 1];
        step.output = `Recipe ${node.recipe} executed successfully`;
    }

    private async executeConditionNode(
        node: RecipeNode,
        context: ChainExecutionContext,
        token?: vscode.CancellationToken
    ): Promise<void> {
        if (!node.condition) {
            throw new Error(`Condition not specified for node: ${node.name}`);
        }

        const conditionResult = await this.evaluateCondition(node.condition, context);
        const step = context.executionHistory[context.executionHistory.length - 1];
        step.conditionResult = conditionResult;

        this.logger.info(`Condition ${node.name}: ${conditionResult}`);

        if (conditionResult && node.children) {
            for (const child of node.children) {
                await this.executeNode(child, context, token);
            }
        } else {
            step.status = 'skipped';
        }
    }

    private async executeSequenceNode(
        node: RecipeNode,
        context: ChainExecutionContext,
        token?: vscode.CancellationToken
    ): Promise<void> {
        if (!node.children) return;

        for (const child of node.children) {
            await this.executeNode(child, context, token);
        }
    }

    private async executeParallelNode(
        node: RecipeNode,
        context: ChainExecutionContext,
        token?: vscode.CancellationToken
    ): Promise<void> {
        if (!node.children) return;

        const promises = node.children.map(child => 
            this.executeNode(child, context, token)
        );

        await Promise.all(promises);
    }

    private async checkConditions(
        conditions: RecipeCondition[],
        context: ChainExecutionContext
    ): Promise<void> {
        for (const condition of conditions) {
            const result = await this.evaluateCondition(condition, context);
            if (!result) {
                throw new Error(`Precondition failed: ${condition.expression}`);
            }
        }
    }

    private async evaluateCondition(
        condition: RecipeCondition,
        context: ChainExecutionContext
    ): Promise<boolean> {
        let result = false;

        switch (condition.type) {
            case 'language':
                result = await this.evaluateLanguageCondition(condition.expression, context);
                break;
            case 'framework':
                result = await this.evaluateFrameworkCondition(condition.expression, context);
                break;
            case 'dependency':
                result = await this.evaluateDependencyCondition(condition.expression, context);
                break;
            case 'pattern':
                result = await this.evaluatePatternCondition(condition.expression, context);
                break;
            case 'custom':
                result = await this.evaluateCustomCondition(condition.expression, context);
                break;
        }

        return condition.negate ? !result : result;
    }

    private async evaluateLanguageCondition(expression: string, context: ChainExecutionContext): Promise<boolean> {
        // Simplified language condition evaluation
        if (expression === 'java') {
            return context.targetFiles.some(file => file.endsWith('.java'));
        }
        return false;
    }

    private async evaluateFrameworkCondition(expression: string, context: ChainExecutionContext): Promise<boolean> {
        // Check for framework presence in the workspace
        // This would typically check build files, dependencies, etc.
        return true; // Placeholder
    }

    private async evaluateDependencyCondition(expression: string, context: ChainExecutionContext): Promise<boolean> {
        // Evaluate dependency-related conditions
        // This would check pom.xml, build.gradle, package.json, etc.
        return true; // Placeholder
    }

    private async evaluatePatternCondition(expression: string, context: ChainExecutionContext): Promise<boolean> {
        // Check if specific patterns exist in the codebase
        // This would use the pattern detection service
        return true; // Placeholder
    }

    private async evaluateCustomCondition(expression: string, context: ChainExecutionContext): Promise<boolean> {
        // Evaluate custom JavaScript expressions
        try {
            const func = new Function('context', `return ${expression}`);
            return Boolean(func(context));
        } catch (error) {
            this.logger.warn(`Custom condition evaluation failed: ${error}`);
            return false;
        }
    }

    // Utility methods
    private calculateChainComplexity(node: RecipeNode): 'simple' | 'moderate' | 'complex' {
        const nodeCount = this.countNodes(node);
        const hasConditions = this.hasConditions(node);
        const hasParallelism = this.hasParallelism(node);

        if (nodeCount > 10 || (hasConditions && hasParallelism)) {
            return 'complex';
        } else if (nodeCount > 5 || hasConditions || hasParallelism) {
            return 'moderate';
        } else {
            return 'simple';
        }
    }

    private countNodes(node: RecipeNode): number {
        let count = 1;
        if (node.children) {
            count += node.children.reduce((sum, child) => sum + this.countNodes(child), 0);
        }
        return count;
    }

    private hasConditions(node: RecipeNode): boolean {
        if (node.type === 'condition') return true;
        if (node.children) {
            return node.children.some(child => this.hasConditions(child));
        }
        return false;
    }

    private hasParallelism(node: RecipeNode): boolean {
        if (node.type === 'parallel') return true;
        if (node.children) {
            return node.children.some(child => this.hasParallelism(child));
        }
        return false;
    }

    private estimateChainDuration(node: RecipeNode): number {
        // Estimate duration in milliseconds
        let duration = 0;
        
        if (node.type === 'recipe') {
            duration = node.metadata?.estimatedTime || 10000; // 10 seconds default
        }
        
        if (node.children) {
            if (node.type === 'parallel') {
                // For parallel execution, take the maximum duration
                duration += Math.max(...node.children.map(child => this.estimateChainDuration(child)));
            } else {
                // For sequential execution, sum all durations
                duration += node.children.reduce((sum, child) => sum + this.estimateChainDuration(child), 0);
            }
        }
        
        return duration;
    }

    private calculatePatternPriority(patterns: any[]): number {
        // Calculate priority based on pattern impacts
        let priority = 0;
        
        patterns.forEach(pattern => {
            if (pattern.metadata.securityImpact === 'high') priority += 10;
            if (pattern.metadata.performanceImpact === 'high') priority += 8;
            if (pattern.metadata.maintainabilityImpact === 'high') priority += 6;
            if (pattern.confidence > 90) priority += 5;
        });
        
        return Math.min(priority, 100);
    }

    private calculateSuccessRate(chain: RecipeChain): number {
        const chainExecutions = this.executionHistory.filter(exec => exec.chainId === chain.id);
        if (chainExecutions.length === 0) return 0;
        
        const successful = chainExecutions.filter(exec => exec.status === 'completed').length;
        return (successful / chainExecutions.length) * 100;
    }

    private generateExecutionSummary(context: ChainExecutionContext): ExecutionSummary {
        const history = context.executionHistory;
        
        return {
            totalNodes: history.length,
            executedNodes: history.filter(step => step.status !== 'pending').length,
            successfulNodes: history.filter(step => step.status === 'completed').length,
            failedNodes: history.filter(step => step.status === 'failed').length,
            skippedNodes: history.filter(step => step.status === 'skipped').length,
            totalDuration: history.reduce((sum, step) => {
                if (step.startTime && step.endTime) {
                    return sum + (step.endTime.getTime() - step.startTime.getTime());
                }
                return sum;
            }, 0),
            filesModified: 0, // Would be calculated from actual execution results
            warnings: [],
            errors: history.filter(step => step.error).map(step => step.error!)
        };
    }

    // Public API
    getChain(id: string): RecipeChain | undefined {
        return this.chains.get(id);
    }

    getAllChains(): RecipeChain[] {
        return Array.from(this.chains.values());
    }

    getChainsByCategory(category: string): RecipeChain[] {
        return this.getAllChains().filter(chain => chain.metadata.category === category);
    }

    getExecutionHistory(): ChainExecutionResult[] {
        return [...this.executionHistory];
    }

    async saveChain(chain: RecipeChain): Promise<void> {
        const chainsDir = path.join(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
            '.vscode', 'moderne', 'chains'
        );
        
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(chainsDir));
        
        const chainFile = path.join(chainsDir, `${chain.id}.json`);
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(chainFile),
            Buffer.from(JSON.stringify(chain, null, 2), 'utf8')
        );
        
        this.logger.info(`Saved chain: ${chain.name}`);
    }

    async loadChainsFromWorkspace(): Promise<void> {
        const chainsDir = path.join(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
            '.vscode', 'moderne', 'chains'
        );
        
        try {
            const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(chainsDir));
            
            for (const [fileName, fileType] of files) {
                if (fileType === vscode.FileType.File && fileName.endsWith('.json')) {
                    try {
                        const content = await vscode.workspace.fs.readFile(
                            vscode.Uri.file(path.join(chainsDir, fileName))
                        );
                        const chain = JSON.parse(content.toString()) as RecipeChain;
                        this.chains.set(chain.id, chain);
                    } catch (error) {
                        this.logger.warn(`Failed to load chain ${fileName}: ${error}`);
                    }
                }
            }
            
            this.logger.info(`Loaded chains from workspace`);
        } catch (error) {
            this.logger.debug(`No chains directory found: ${error}`);
        }
    }

    dispose(): void {
        this._onDidCreateChain.dispose();
        this._onDidExecuteChain.dispose();
        this._onDidUpdateProgress.dispose();
    }
}

// Supporting interfaces
interface RecipeChainTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    structure: {
        phases: string[];
        defaultExecutionMode: 'sequence' | 'parallel';
        supportedConditions: string[];
        commonRecipes: string[];
    };
}