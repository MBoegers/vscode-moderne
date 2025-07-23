import * as vscode from 'vscode';
import * as path from 'path';
import { CliService } from './cliService';
import { ConfigService } from './configService';
import { RepositoryService } from './repositoryService';
import { Logger } from '../utils/logger';

export interface WorkflowStep {
    id: string;
    name: string;
    command: string;
    args: string[];
    condition?: (context: WorkflowContext) => boolean;
    onSuccess?: (result: WorkflowStepResult) => void;
    onError?: (error: Error) => void;
    timeout?: number;
    retries?: number;
}

export interface WorkflowContext {
    workspaceRoot: string;
    activeRecipe?: string;
    repositories: string[];
    variables: Record<string, any>;
    stepResults: WorkflowStepResult[];
}

export interface WorkflowStepResult {
    stepId: string;
    success: boolean;
    output: string;
    error?: Error;
    duration: number;
    timestamp: Date;
}

export interface Workflow {
    id: string;
    name: string;
    description: string;
    steps: WorkflowStep[];
    parallel?: boolean;
    continueOnError?: boolean;
    variables?: Record<string, any>;
}

export interface WorkflowExecution {
    id: string;
    workflowId: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: Date;
    endTime?: Date;
    context: WorkflowContext;
    results: WorkflowStepResult[];
    currentStep?: string;
    progress: number;
}

export class WorkflowService {
    private executions = new Map<string, WorkflowExecution>();
    private workflows = new Map<string, Workflow>();
    private readonly _onDidStartExecution = new vscode.EventEmitter<WorkflowExecution>();
    private readonly _onDidCompleteExecution = new vscode.EventEmitter<WorkflowExecution>();
    private readonly _onDidUpdateProgress = new vscode.EventEmitter<{ execution: WorkflowExecution; step: WorkflowStepResult }>();

    readonly onDidStartExecution = this._onDidStartExecution.event;
    readonly onDidCompleteExecution = this._onDidCompleteExecution.event;
    readonly onDidUpdateProgress = this._onDidUpdateProgress.event;

    constructor(
        private cliService: CliService,
        private configService: ConfigService,
        private repositoryService: RepositoryService,
        private logger: Logger
    ) {
        this.initializeBuiltInWorkflows();
    }

    private initializeBuiltInWorkflows(): void {
        // Recipe validation workflow
        const recipeValidationWorkflow: Workflow = {
            id: 'recipe-validation',
            name: 'Recipe Validation Pipeline',
            description: 'Comprehensive recipe validation and testing',
            steps: [
                {
                    id: 'syntax-check',
                    name: 'Syntax Validation',
                    command: 'mod',
                    args: ['build', '--dry-run', '${activeRecipe}'],
                    timeout: 30000
                },
                {
                    id: 'dependency-check', 
                    name: 'Dependency Validation',
                    command: 'mod',
                    args: ['study', '--recipe', '${activeRecipe}', '--dependencies'],
                    timeout: 60000
                },
                {
                    id: 'test-run',
                    name: 'Test Recipe Execution',
                    command: 'mod',
                    args: ['run', '--recipe', '${activeRecipe}', '--dry-run', '${workspaceRoot}'],
                    timeout: 120000
                }
            ]
        };

        // Repository analysis workflow
        const repoAnalysisWorkflow: Workflow = {
            id: 'repository-analysis',
            name: 'Repository Analysis Pipeline',
            description: 'Analyze repositories for modernization opportunities',
            steps: [
                {
                    id: 'scan-dependencies',
                    name: 'Scan Dependencies',
                    command: 'mod',
                    args: ['study', '--scope', 'dependencies', '${repository}'],
                    timeout: 180000
                },
                {
                    id: 'analyze-patterns',
                    name: 'Pattern Analysis',
                    command: 'mod',
                    args: ['study', '--scope', 'patterns', '${repository}'],
                    timeout: 300000
                },
                {
                    id: 'security-scan',
                    name: 'Security Analysis',
                    command: 'mod',
                    args: ['study', '--scope', 'security', '${repository}'],
                    timeout: 240000
                }
            ],
            parallel: true
        };

        // Bulk modernization workflow
        const bulkModernizationWorkflow: Workflow = {
            id: 'bulk-modernization',
            name: 'Bulk Repository Modernization',
            description: 'Apply recipes across multiple repositories',
            steps: [
                {
                    id: 'validate-recipe',
                    name: 'Validate Recipe',
                    command: 'mod',
                    args: ['build', '${activeRecipe}'],
                    timeout: 60000
                },
                {
                    id: 'dry-run-all',
                    name: 'Dry Run Analysis',
                    command: 'mod',
                    args: ['run', '--recipe', '${activeRecipe}', '--dry-run', '${repositories}'],
                    timeout: 600000
                },
                {
                    id: 'apply-changes',
                    name: 'Apply Modernization',
                    command: 'mod',
                    args: ['run', '--recipe', '${activeRecipe}', '${repositories}'],
                    timeout: 900000,
                    condition: (context) => context.variables.confirmApply === true
                }
            ]
        };

        this.workflows.set(recipeValidationWorkflow.id, recipeValidationWorkflow);
        this.workflows.set(repoAnalysisWorkflow.id, repoAnalysisWorkflow);
        this.workflows.set(bulkModernizationWorkflow.id, bulkModernizationWorkflow);
    }

    async executeWorkflow(
        workflowId: string, 
        context: Partial<WorkflowContext>,
        token?: vscode.CancellationToken
    ): Promise<WorkflowExecution> {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }

        const executionId = this.generateExecutionId();
        const execution: WorkflowExecution = {
            id: executionId,
            workflowId,
            status: 'running',
            startTime: new Date(),
            context: await this.buildWorkflowContext(context),
            results: [],
            progress: 0
        };

        this.executions.set(executionId, execution);
        this._onDidStartExecution.fire(execution);

        try {
            if (workflow.parallel) {
                await this.executeStepsParallel(workflow, execution, token);
            } else {
                await this.executeStepsSequential(workflow, execution, token);
            }

            execution.status = 'completed';
            execution.endTime = new Date();
            execution.progress = 100;

        } catch (error) {
            execution.status = 'failed';
            execution.endTime = new Date();
            this.logger.error(`Workflow execution failed: ${error}`);
            
            if (!workflow.continueOnError) {
                throw error;
            }
        }

        this._onDidCompleteExecution.fire(execution);
        return execution;
    }

    private async executeStepsSequential(
        workflow: Workflow,
        execution: WorkflowExecution,
        token?: vscode.CancellationToken
    ): Promise<void> {
        for (let i = 0; i < workflow.steps.length; i++) {
            if (token?.isCancellationRequested) {
                execution.status = 'cancelled';
                break;
            }

            const step = workflow.steps[i];
            execution.currentStep = step.id;

            // Check step condition
            if (step.condition && !step.condition(execution.context)) {
                this.logger.info(`Skipping step ${step.id} - condition not met`);
                continue;
            }

            const stepResult = await this.executeStep(step, execution.context);
            execution.results.push(stepResult);
            execution.progress = ((i + 1) / workflow.steps.length) * 100;

            this._onDidUpdateProgress.fire({ execution, step: stepResult });

            if (!stepResult.success && !workflow.continueOnError) {
                throw stepResult.error || new Error(`Step ${step.id} failed`);
            }
        }
    }

    private async executeStepsParallel(
        workflow: Workflow,
        execution: WorkflowExecution,
        token?: vscode.CancellationToken
    ): Promise<void> {
        const stepPromises = workflow.steps.map(async (step) => {
            if (token?.isCancellationRequested) {
                return null;
            }

            if (step.condition && !step.condition(execution.context)) {
                return null;
            }

            return this.executeStep(step, execution.context);
        });

        const results = await Promise.allSettled(stepPromises);
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                execution.results.push(result.value);
                this._onDidUpdateProgress.fire({ execution, step: result.value });
            } else if (result.status === 'rejected') {
                const stepResult: WorkflowStepResult = {
                    stepId: workflow.steps[index].id,
                    success: false,
                    output: '',
                    error: result.reason,
                    duration: 0,
                    timestamp: new Date()
                };
                execution.results.push(stepResult);
            }
        });

        execution.progress = 100;
    }

    private async executeStep(step: WorkflowStep, context: WorkflowContext): Promise<WorkflowStepResult> {
        const startTime = Date.now();
        const result: WorkflowStepResult = {
            stepId: step.id,
            success: false,
            output: '',
            duration: 0,
            timestamp: new Date()
        };

        try {
            // Expand variables in command arguments
            const expandedArgs = step.args.map(arg => this.expandVariables(arg, context));
            
            this.logger.info(`Executing step: ${step.name}`);
            this.logger.debug(`Command: ${step.command} ${expandedArgs.join(' ')}`);

            // Execute with retries
            let lastError: Error | undefined;
            const maxRetries = step.retries || 0;
            
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const output = await this.cliService.executeCommand(
                        step.command,
                        expandedArgs,
                        {
                            timeout: step.timeout || 60000,
                            cwd: context.workspaceRoot
                        }
                    );

                    result.success = true;
                    result.output = output;
                    
                    if (step.onSuccess) {
                        step.onSuccess(result);
                    }
                    
                    break;

                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));
                    
                    if (attempt < maxRetries) {
                        this.logger.warn(`Step ${step.id} failed, retrying... (${attempt + 1}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    }
                }
            }

            if (!result.success && lastError) {
                result.error = lastError;
                if (step.onError) {
                    step.onError(lastError);
                }
            }

        } catch (error) {
            result.error = error instanceof Error ? error : new Error(String(error));
            this.logger.error(`Step execution failed: ${result.error.message}`);
        }

        result.duration = Date.now() - startTime;
        return result;
    }

    private expandVariables(template: string, context: WorkflowContext): string {
        return template.replace(/\$\{([^}]+)\}/g, (match, key) => {
            switch (key) {
                case 'workspaceRoot':
                    return context.workspaceRoot;
                case 'activeRecipe':
                    return context.activeRecipe || '';
                case 'repositories':
                    return context.repositories.join(' ');
                case 'repository':
                    return context.repositories[0] || '';
                default:
                    return context.variables[key]?.toString() || match;
            }
        });
    }

    private async buildWorkflowContext(partial: Partial<WorkflowContext>): Promise<WorkflowContext> {
        const workspaceRoot = partial.workspaceRoot || 
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

        const repositories = partial.repositories || 
            await this.repositoryService.getLocalRepositories();

        return {
            workspaceRoot,
            activeRecipe: partial.activeRecipe,
            repositories,
            variables: partial.variables || {},
            stepResults: []
        };
    }

    private generateExecutionId(): string {
        return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public API methods
    getWorkflows(): Workflow[] {
        return Array.from(this.workflows.values());
    }

    getWorkflow(id: string): Workflow | undefined {
        return this.workflows.get(id);
    }

    registerWorkflow(workflow: Workflow): void {
        this.workflows.set(workflow.id, workflow);
        this.logger.info(`Registered workflow: ${workflow.name}`);
    }

    getExecution(id: string): WorkflowExecution | undefined {
        return this.executions.get(id);
    }

    getActiveExecutions(): WorkflowExecution[] {
        return Array.from(this.executions.values())
            .filter(execution => execution.status === 'running');
    }

    async cancelExecution(id: string): Promise<void> {
        const execution = this.executions.get(id);
        if (execution && execution.status === 'running') {
            execution.status = 'cancelled';
            execution.endTime = new Date();
            this._onDidCompleteExecution.fire(execution);
        }
    }

    // Built-in workflow helpers
    async validateRecipe(recipePath: string): Promise<WorkflowExecution> {
        return this.executeWorkflow('recipe-validation', {
            activeRecipe: recipePath,
            workspaceRoot: path.dirname(recipePath)
        });
    }

    async analyzeRepository(repositoryPath: string): Promise<WorkflowExecution> {
        return this.executeWorkflow('repository-analysis', {
            repositories: [repositoryPath],
            workspaceRoot: repositoryPath
        });
    }

    async bulkModernize(recipePath: string, repositories: string[]): Promise<WorkflowExecution> {
        return this.executeWorkflow('bulk-modernization', {
            activeRecipe: recipePath,
            repositories,
            variables: { confirmApply: false } // Requires explicit confirmation
        });
    }

    dispose(): void {
        this._onDidStartExecution.dispose();
        this._onDidCompleteExecution.dispose();
        this._onDidUpdateProgress.dispose();
        this.executions.clear();
    }
}