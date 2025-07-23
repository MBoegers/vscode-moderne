import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { ConfigService } from './configService';
import { Logger } from '../utils/logger';
import { CliResult, CliError, CliVersion, LicenseInfo, CliCommand } from '../models/cliResult';
import { Repository, Organization, BuildStatus } from '../models/repository';

export class CliService {
    private configService: ConfigService;
    private logger: Logger;
    private cliPath: string = '';

    constructor(configService: ConfigService, logger: Logger) {
        this.configService = configService;
        this.logger = logger;
        this.updateCliPath();

        // Listen for configuration changes
        this.configService.onDidChangeConfiguration(() => {
            this.updateCliPath();
        });
    }

    private updateCliPath(): void {
        this.cliPath = this.configService.getCliPath();
        this.logger.debug(`CLI path updated: ${this.cliPath}`);
    }

    /**
     * Execute a CLI command with proper error handling
     */
    async executeCommand(args: string[], options?: {
        cwd?: string;
        timeout?: number;
        input?: string;
    }): Promise<CliResult> {
        const startTime = Date.now();
        const command = this.cliPath;
        const fullCommand = `${command} ${args.join(' ')}`;
        
        this.logger.debug(`Executing CLI command: ${fullCommand}`);

        return new Promise((resolve) => {
            const childProcess = cp.spawn(command, args, {
                cwd: options?.cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                timeout: options?.timeout || 30000,
                shell: true
            });

            let stdout = '';
            let stderr = '';

            childProcess.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            childProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            if (options?.input) {
                childProcess.stdin?.write(options.input);
                childProcess.stdin?.end();
            }

            childProcess.on('close', (code) => {
                const duration = Date.now() - startTime;
                const exitCode = code ?? -1;
                this.logger.debug(`CLI command completed in ${duration}ms with exit code: ${exitCode}`);

                if (exitCode === 0) {
                    try {
                        // Try to parse JSON response
                        const data = stdout.trim() ? JSON.parse(stdout) : null;
                        resolve({
                            success: true,
                            data,
                            exitCode,
                            stdout,
                            stderr
                        });
                    } catch (error) {
                        // Not JSON, return raw stdout
                        resolve({
                            success: true,
                            data: stdout.trim(),
                            exitCode,
                            stdout,
                            stderr
                        });
                    }
                } else {
                    const errorMessage = stderr || stdout || `Command failed with exit code ${exitCode}`;
                    this.logger.error(`CLI command failed: ${errorMessage}`);
                    
                    resolve({
                        success: false,
                        error: errorMessage,
                        exitCode,
                        stdout,
                        stderr
                    });
                }
            });

            childProcess.on('error', (error) => {
                const duration = Date.now() - startTime;
                this.logger.error(`CLI command error after ${duration}ms: ${error.message}`, error);
                
                resolve({
                    success: false,
                    error: error.message,
                    stderr: error.message
                });
            });

            // Handle timeout
            setTimeout(() => {
                if (!childProcess.killed) {
                    childProcess.kill();
                    resolve({
                        success: false,
                        error: `Command timed out after ${options?.timeout || 30000}ms`
                    });
                }
            }, options?.timeout || 30000);
        });
    }

    /**
     * Check CLI version and availability
     */
    async checkVersion(): Promise<string> {
        try {
            const result = await this.executeCommand(['--version']);
            
            if (!result.success) {
                throw new CliError('Failed to get CLI version', result.exitCode, result.stderr);
            }

            // Parse version from output (format: "Moderne CLI version X.Y.Z")
            const versionMatch = result.data?.match(/version\s+([\d.]+)/i);
            if (versionMatch) {
                return versionMatch[1];
            }

            // Fallback to raw output
            return result.data || 'unknown';

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to check CLI version', error);
            throw new CliError(`CLI not available: ${message}`);
        }
    }

    /**
     * Validate Moderne license
     */
    async validateLicense(): Promise<boolean> {
        try {
            const result = await this.executeCommand(['config', 'license', 'show', '--json']);
            
            if (!result.success) {
                this.logger.warn('License validation failed', result.error);
                return false;
            }

            const licenseInfo = result.data as LicenseInfo;
            return licenseInfo?.valid === true;

        } catch (error) {
            this.logger.warn('Failed to validate license', error);
            return false;
        }
    }

    /**
     * Get detailed license information
     */
    async getLicenseInfo(): Promise<LicenseInfo | null> {
        try {
            const result = await this.executeCommand(['config', 'license', 'show', '--json']);
            
            if (!result.success) {
                return null;
            }

            return result.data as LicenseInfo;

        } catch (error) {
            this.logger.error('Failed to get license info', error);
            return null;
        }
    }

    /**
     * List repositories in a given path
     */
    async listRepositories(path: string): Promise<Repository[]> {
        try {
            const result = await this.executeCommand(['list', path, '--json']);
            
            if (!result.success) {
                throw new CliError('Failed to list repositories', result.exitCode, result.stderr);
            }

            // Transform CLI response to our Repository model
            const repositories: Repository[] = (result.data || []).map((repo: any) => ({
                id: repo.id || repo.name,
                name: repo.name,
                path: repo.path,
                organization: repo.organization,
                hasLst: repo.hasLst || false,
                buildStatus: this.mapBuildStatus(repo.buildStatus),
                lastBuildTime: repo.lastBuildTime ? new Date(repo.lastBuildTime) : undefined,
                branches: repo.branches || [],
                remoteUrl: repo.remoteUrl
            }));

            this.logger.info(`Found ${repositories.length} repositories in ${path}`);
            return repositories;

        } catch (error) {
            this.logger.error(`Failed to list repositories in ${path}`, error);
            throw error;
        }
    }

    /**
     * Get organizations from Moderne platform
     */
    async listOrganizations(): Promise<Organization[]> {
        try {
            const result = await this.executeCommand(['config', 'moderne', 'organizations', 'show', '--json']);
            
            if (!result.success) {
                throw new CliError('Failed to list organizations', result.exitCode, result.stderr);
            }

            return (result.data || []).map((org: any) => ({
                id: org.id,
                name: org.name,
                repositories: []
            }));

        } catch (error) {
            this.logger.error('Failed to list organizations', error);
            throw error;
        }
    }

    /**
     * Build LSTs for a repository or path
     */
    async buildLsts(path: string): Promise<CliResult> {
        try {
            this.logger.info(`Building LSTs for ${path}`);
            
            const result = await this.executeCommand(['build', path], {
                timeout: 300000 // 5 minutes
            });

            if (result.success) {
                this.logger.info(`Successfully built LSTs for ${path}`);
            } else {
                this.logger.error(`Failed to build LSTs for ${path}: ${result.error}`);
            }

            return result;

        } catch (error) {
            this.logger.error(`Error building LSTs for ${path}`, error);
            throw error;
        }
    }

    /**
     * Run a recipe with active recipe
     */
    async runActiveRecipe(path: string, options?: {
        debug?: boolean;
        recipeOptions?: Record<string, string>;
    }): Promise<CliResult> {
        try {
            const args = ['run', path, '--active-recipe'];
            
            if (options?.debug) {
                args.push('--jvm-debug');
            }

            if (options?.recipeOptions) {
                Object.entries(options.recipeOptions).forEach(([key, value]) => {
                    args.push('--recipe-option', `${key}=${value}`);
                });
            }

            this.logger.info(`Running active recipe for ${path}`);
            
            const result = await this.executeCommand(args, {
                timeout: 600000 // 10 minutes
            });

            return result;

        } catch (error) {
            this.logger.error(`Error running active recipe for ${path}`, error);
            throw error;
        }
    }

    /**
     * Check if CLI is available and configured
     */
    async isAvailable(): Promise<boolean> {
        try {
            await this.checkVersion();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Map CLI build status to our enum
     */
    private mapBuildStatus(status: string): BuildStatus {
        switch (status?.toLowerCase()) {
            case 'success':
                return BuildStatus.Success;
            case 'failed':
                return BuildStatus.Failed;
            case 'building':
                return BuildStatus.Building;
            case 'error':
                return BuildStatus.Error;
            default:
                return BuildStatus.Unknown;
        }
    }

    /**
     * Get CLI executable path for debugging
     */
    getCliExecutablePath(): string {
        return this.cliPath;
    }
}