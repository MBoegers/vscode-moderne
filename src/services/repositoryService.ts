import * as vscode from 'vscode';
import { CliService } from './cliService';
import { Logger } from '../utils/logger';
import { Repository, Organization, MultiRepo, RepositoryStatus, BuildStatus } from '../models/repository';

export class RepositoryService {
    protected cliService: CliService;
    protected logger: Logger;
    private repositories: Repository[] = [];
    private organizations: Organization[] = [];
    private multiRepos: MultiRepo[] = [];

    private _onRepositoriesChanged = new vscode.EventEmitter<Repository[]>();
    public readonly onRepositoriesChanged = this._onRepositoriesChanged.event;

    private _onOrganizationsChanged = new vscode.EventEmitter<Organization[]>();
    public readonly onOrganizationsChanged = this._onOrganizationsChanged.event;

    constructor(cliService: CliService, logger: Logger) {
        this.cliService = cliService;
        this.logger = logger;
    }

    /**
     * Get all repositories
     */
    getRepositories(): Repository[] {
        return [...this.repositories];
    }

    /**
     * Get all organizations
     */
    getOrganizations(): Organization[] {
        return [...this.organizations];
    }

    /**
     * Get all multi-repos
     */
    getMultiRepos(): MultiRepo[] {
        return [...this.multiRepos];
    }

    /**
     * Refresh repositories from all configured sources
     */
    async refreshRepositories(): Promise<void> {
        try {
            this.logger.info('Refreshing repositories...');
            
            const allRepositories: Repository[] = [];
            const config = vscode.workspace.getConfiguration('moderne');
            
            // Load from local paths
            const localPaths = config.get<string[]>('multiRepos.localPaths', []);
            for (const localPath of localPaths) {
                try {
                    const repos = await this.cliService.listRepositories(localPath);
                    allRepositories.push(...repos);
                    this.logger.debug(`Loaded ${repos.length} repositories from ${localPath}`);
                } catch (error) {
                    this.logger.warn(`Failed to load repositories from ${localPath}`, error);
                }
            }

            // Load from organizations
            const orgConfigs = config.get<any[]>('multiRepos.organizations', []);
            if (orgConfigs.length > 0) {
                try {
                    const organizations = await this.cliService.listOrganizations();
                    this.organizations = organizations;
                    this._onOrganizationsChanged.fire(this.organizations);

                    // For each configured organization, get its repositories
                    for (const orgConfig of orgConfigs) {
                        const org = organizations.find(o => o.id === orgConfig.id);
                        if (org) {
                            // Organizations would have their repos loaded separately
                            // This is a placeholder for organization repository loading
                            this.logger.debug(`Found organization: ${org.name}`);
                        }
                    }
                } catch (error) {
                    this.logger.warn('Failed to load organizations', error);
                }
            }

            // Update repositories and notify listeners
            this.repositories = allRepositories;
            this._onRepositoriesChanged.fire(this.repositories);
            
            this.logger.info(`Refreshed repositories: ${this.repositories.length} total`);

        } catch (error) {
            this.logger.error('Failed to refresh repositories', error);
            throw error;
        }
    }

    /**
     * Get repository status including LST availability
     */
    async getRepositoryStatus(repository: Repository): Promise<RepositoryStatus> {
        try {
            // This would check if LST files exist and get their metadata
            // For now, return basic status based on repository info
            return {
                repository,
                lstExists: repository.hasLst,
                lastModified: repository.lastBuildTime
            };
        } catch (error) {
            this.logger.error(`Failed to get status for repository ${repository.name}`, error);
            return {
                repository,
                lstExists: false
            };
        }
    }

    /**
     * Build LSTs for a repository
     */
    async buildRepository(repository: Repository): Promise<void> {
        try {
            this.logger.info(`Building LSTs for repository: ${repository.name}`);
            
            // Update repository status to building
            repository.buildStatus = BuildStatus.Building;
            this._onRepositoriesChanged.fire(this.repositories);

            const result = await this.cliService.buildLsts(repository.path);
            
            if (result.success) {
                repository.buildStatus = BuildStatus.Success;
                repository.hasLst = true;
                repository.lastBuildTime = new Date();
                this.logger.info(`Successfully built LSTs for ${repository.name}`);
            } else {
                repository.buildStatus = BuildStatus.Failed;
                this.logger.error(`Failed to build LSTs for ${repository.name}: ${result.error}`);
                throw new Error(result.error || 'Build failed');
            }

        } catch (error) {
            repository.buildStatus = BuildStatus.Error;
            this.logger.error(`Error building repository ${repository.name}`, error);
            throw error;
        } finally {
            this._onRepositoriesChanged.fire(this.repositories);
        }
    }

    /**
     * Find repository by name or path
     */
    findRepository(identifier: string): Repository | undefined {
        return this.repositories.find(repo => 
            repo.name === identifier || 
            repo.path === identifier ||
            repo.id === identifier
        );
    }

    /**
     * Get repositories by organization
     */
    getRepositoriesByOrganization(organizationId: string): Repository[] {
        return this.repositories.filter(repo => repo.organization === organizationId);
    }

    /**
     * Check if any repositories are available
     */
    hasRepositories(): boolean {
        return this.repositories.length > 0;
    }

    /**
     * Get repositories with LSTs built
     */
    getRepositoriesWithLsts(): Repository[] {
        return this.repositories.filter(repo => repo.hasLst);
    }

    /**
     * Get build statistics
     */
    getBuildStatistics(): {
        total: number;
        withLsts: number;
        building: number;
        failed: number;
    } {
        const total = this.repositories.length;
        const withLsts = this.repositories.filter(repo => repo.hasLst).length;
        const building = this.repositories.filter(repo => repo.buildStatus === BuildStatus.Building).length;
        const failed = this.repositories.filter(repo => repo.buildStatus === BuildStatus.Failed).length;

        return { total, withLsts, building, failed };
    }

    /**
     * Clear all cached repository data
     */
    clearCache(): void {
        this.repositories = [];
        this.organizations = [];
        this.multiRepos = [];
        this._onRepositoriesChanged.fire(this.repositories);
        this._onOrganizationsChanged.fire(this.organizations);
        this.logger.info('Repository cache cleared');
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this._onRepositoriesChanged.dispose();
        this._onOrganizationsChanged.dispose();
    }
}