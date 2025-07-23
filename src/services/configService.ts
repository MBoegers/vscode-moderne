import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export interface MultiRepoConfig {
    name: string;
    id: string;
}

export interface ModerneConfiguration {
    enabled: boolean;
    cli: {
        useSystemPath: boolean;
        path: string;
        jarPath?: string;
    };
    multiRepos: {
        localPaths: string[];
        organizations: MultiRepoConfig[];
    };
    recipes: {
        defaultType: 'refaster' | 'visitor' | 'yaml';
        templatePath?: string;
    };
    logging: {
        level: 'error' | 'warn' | 'info' | 'debug';
    };
}

export class ConfigService {
    private context: vscode.ExtensionContext;
    private _onDidChangeConfiguration = new vscode.EventEmitter<void>();
    public readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('moderne')) {
                this._onDidChangeConfiguration.fire();
            }
        });
    }

    /**
     * Get the complete Moderne configuration
     */
    getConfiguration(): ModerneConfiguration {
        const config = vscode.workspace.getConfiguration('moderne');
        
        return {
            enabled: config.get<boolean>('enabled', true),
            cli: {
                useSystemPath: config.get<boolean>('cli.useSystemPath', true),
                path: config.get<string>('cli.path', 'mod'),
                jarPath: config.get<string>('cli.jarPath')
            },
            multiRepos: {
                localPaths: config.get<string[]>('multiRepos.localPaths', []),
                organizations: config.get<MultiRepoConfig[]>('multiRepos.organizations', [])
            },
            recipes: {
                defaultType: config.get<'refaster' | 'visitor' | 'yaml'>('recipes.defaultType', 'refaster'),
                templatePath: config.get<string>('recipes.templatePath')
            },
            logging: {
                level: config.get<'error' | 'warn' | 'info' | 'debug'>('logging.level', 'info')
            }
        };
    }

    /**
     * Get the CLI executable path based on configuration
     */
    getCliPath(): string {
        const config = this.getConfiguration();
        
        if (config.cli.jarPath) {
            // Use Java to run the JAR
            return `java -jar "${config.cli.jarPath}"`;
        }
        
        if (config.cli.useSystemPath) {
            return 'mod';
        }
        
        return config.cli.path;
    }

    /**
     * Get the active recipe file path
     */
    getActiveRecipeFilePath(): string {
        return path.join(os.homedir(), '.moderne', 'cli', 'active.recipe');
    }

    /**
     * Check if the extension is enabled
     */
    isEnabled(): boolean {
        return this.getConfiguration().enabled;
    }

    /**
     * Get multi-repository configurations
     */
    getMultiRepos(): { localPaths: string[]; organizations: MultiRepoConfig[] } {
        return this.getConfiguration().multiRepos;
    }

    /**
     * Get recipe configuration
     */
    getRecipeConfig(): { defaultType: string; templatePath?: string } {
        return this.getConfiguration().recipes;
    }

    /**
     * Update a configuration value
     */
    async updateConfiguration(section: string, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
        const config = vscode.workspace.getConfiguration('moderne');
        await config.update(section, value, target);
    }

    /**
     * Get global state (persists across workspace changes)
     */
    getGlobalState<T>(key: string, defaultValue?: T): T | undefined {
        return this.context.globalState.get(key, defaultValue);
    }

    /**
     * Set global state
     */
    async setGlobalState<T>(key: string, value: T): Promise<void> {
        await this.context.globalState.update(key, value);
    }

    /**
     * Get workspace state (workspace-specific)
     */
    getWorkspaceState<T>(key: string, defaultValue?: T): T | undefined {
        return this.context.workspaceState.get(key, defaultValue);
    }

    /**
     * Set workspace state
     */
    async setWorkspaceState<T>(key: string, value: T): Promise<void> {
        await this.context.workspaceState.update(key, value);
    }

    /**
     * Get extension context for accessing storage paths
     */
    getContext(): vscode.ExtensionContext {
        return this.context;
    }

    /**
     * Validate configuration settings
     */
    validateConfiguration(): string[] {
        const errors: string[] = [];
        const config = this.getConfiguration();

        // Validate CLI configuration
        if (config.cli.jarPath && config.cli.useSystemPath) {
            errors.push('Cannot use both system PATH and JAR file for CLI. Please choose one.');
        }

        if (!config.cli.useSystemPath && !config.cli.path && !config.cli.jarPath) {
            errors.push('CLI path must be specified when not using system PATH.');
        }

        // Validate JAR path exists if specified
        if (config.cli.jarPath && !this.pathExists(config.cli.jarPath)) {
            errors.push(`JAR file not found at: ${config.cli.jarPath}`);
        }

        // Validate multi-repo configurations
        config.multiRepos.organizations.forEach((org, index) => {
            if (!org.name || !org.id) {
                errors.push(`Organization at index ${index} must have both name and id.`);
            }
        });

        // Validate local paths exist
        config.multiRepos.localPaths.forEach((localPath, index) => {
            if (!this.pathExists(localPath)) {
                errors.push(`Local repository path not found: ${localPath}`);
            }
        });

        // Validate template path if specified
        if (config.recipes.templatePath && !this.pathExists(config.recipes.templatePath)) {
            errors.push(`Recipe template directory not found: ${config.recipes.templatePath}`);
        }

        return errors;
    }

    /**
     * Validate and get configuration with validation results
     */
    getValidatedConfiguration(): { config: ModerneConfiguration; errors: string[]; warnings: string[] } {
        const config = this.getConfiguration();
        const errors = this.validateConfiguration();
        const warnings: string[] = [];

        // Add warnings for potentially problematic configurations
        if (!config.enabled) {
            warnings.push('Extension is disabled. Enable it to use Moderne features.');
        }

        if (config.multiRepos.localPaths.length === 0 && config.multiRepos.organizations.length === 0) {
            warnings.push('No repository sources configured. Add local paths or organizations to use multi-repo features.');
        }

        return { config, errors, warnings };
    }

    /**
     * Check if a path exists
     */
    private pathExists(filePath: string): boolean {
        try {
            const fs = require('fs');
            return fs.existsSync(filePath);
        } catch {
            return false;
        }
    }

    /**
     * Get configuration health status
     */
    getConfigurationHealth(): { status: 'healthy' | 'warning' | 'error'; issues: string[] } {
        const { errors, warnings } = this.getValidatedConfiguration();
        
        if (errors.length > 0) {
            return { status: 'error', issues: errors };
        } else if (warnings.length > 0) {
            return { status: 'warning', issues: warnings };
        } else {
            return { status: 'healthy', issues: [] };
        }
    }

    /**
     * Reset configuration to defaults
     */
    async resetConfiguration(): Promise<void> {
        const config = vscode.workspace.getConfiguration('moderne');
        const keys = Object.keys(config);
        
        for (const key of keys) {
            await config.update(key, undefined, vscode.ConfigurationTarget.Global);
        }
    }
}