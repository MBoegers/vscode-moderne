import * as vscode from 'vscode';
import { RepositoryService } from '../services/repositoryService';
import { RecipeService } from '../services/recipeService';
import { Logger } from '../utils/logger';
import { Repository, Organization, BuildStatus } from '../models/repository';
import { Recipe } from '../models/recipe';

export class ModerneTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private repositoryService: RepositoryService;
    private recipeService: RecipeService;
    private logger: Logger;

    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(repositoryService: RepositoryService, recipeService: RecipeService, logger: Logger) {
        this.repositoryService = repositoryService;
        this.recipeService = recipeService;
        this.logger = logger;

        // Listen for repository changes
        this.repositoryService.onRepositoriesChanged(() => {
            this.refresh();
        });

        this.repositoryService.onOrganizationsChanged(() => {
            this.refresh();
        });

        // Listen for active recipe changes
        this.recipeService.onActiveRecipeChanged(() => {
            this.refresh();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            // Root level - show organizations and local repositories
            return Promise.resolve(this.getRootItems());
        }

        if (element instanceof OrganizationTreeItem) {
            // Show repositories for this organization
            return Promise.resolve(this.getRepositoryItems(element.organization.id));
        }

        if (element instanceof RepositoryTreeItem) {
            // Show repository details (builds, runs, etc.)
            return Promise.resolve(this.getRepositoryDetails(element.repository));
        }

        if (element instanceof RecipesTreeItem) {
            // Show discovered recipes
            return this.getRecipeItems();
        }

        if (element instanceof LocalRepositoriesTreeItem) {
            // Show local repositories
            return Promise.resolve(this.getRepositoryItems());
        }

        return Promise.resolve([]);
    }

    private getRootItems(): TreeItem[] {
        const items: TreeItem[] = [];

        // Add active recipe section at the top
        const activeRecipe = this.recipeService.getActiveRecipe();
        if (activeRecipe) {
            items.push(new ActiveRecipeTreeItem(activeRecipe));
        }

        // Add recipes section
        items.push(new RecipesTreeItem());

        // Add organizations
        const organizations = this.repositoryService.getOrganizations();
        organizations.forEach(org => {
            items.push(new OrganizationTreeItem(org));
        });

        // Add local repositories that don't belong to an organization
        const repositories = this.repositoryService.getRepositories();
        const localRepos = repositories.filter(repo => !repo.organization);
        
        if (localRepos.length > 0) {
            items.push(new LocalRepositoriesTreeItem(localRepos));
        }

        // Show welcome message if no items
        if (items.length === 0) {
            items.push(new WelcomeTreeItem());
        }

        return items;
    }

    private getRepositoryItems(organizationId?: string): TreeItem[] {
        const repositories = organizationId 
            ? this.repositoryService.getRepositoriesByOrganization(organizationId)
            : this.repositoryService.getRepositories();

        return repositories.map(repo => new RepositoryTreeItem(repo));
    }

    private getRepositoryDetails(repository: Repository): TreeItem[] {
        const items: TreeItem[] = [];

        // Add build status
        items.push(new BuildStatusTreeItem(repository));

        // Add LST status
        if (repository.hasLst) {
            items.push(new LstStatusTreeItem(repository, true));
        } else {
            items.push(new LstStatusTreeItem(repository, false));
        }

        // Add last build time if available
        if (repository.lastBuildTime) {
            items.push(new LastBuildTreeItem(repository));
        }

        return items;
    }

    private async getRecipeItems(): Promise<TreeItem[]> {
        try {
            const recipes = await this.recipeService.discoverRecipes();
            return recipes.map((recipe: Recipe) => new RecipeTreeItem(recipe));
        } catch (error) {
            this.logger.error('Failed to discover recipes', error);
            return [new ErrorTreeItem('Failed to discover recipes')];
        }
    }
}

abstract class TreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState?: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}

class OrganizationTreeItem extends TreeItem {
    constructor(public readonly organization: Organization) {
        super(organization.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.tooltip = `Organization: ${organization.name}`;
        this.iconPath = new vscode.ThemeIcon('organization');
        this.contextValue = 'organization';
    }
}

class LocalRepositoriesTreeItem extends TreeItem {
    constructor(public readonly repositories: Repository[]) {
        super(`Local Repositories (${repositories.length})`, vscode.TreeItemCollapsibleState.Expanded);
        this.tooltip = `${repositories.length} local repositories`;
        this.iconPath = new vscode.ThemeIcon('folder');
        this.contextValue = 'localRepositories';
    }
}

class RepositoryTreeItem extends TreeItem {
    constructor(public readonly repository: Repository) {
        super(repository.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = 'repository';
        this.description = this.getDescription();
    }

    private getTooltip(): string {
        const lines = [
            `Repository: ${this.repository.name}`,
            `Path: ${this.repository.path}`,
            `Build Status: ${this.repository.buildStatus}`,
            `Has LST: ${this.repository.hasLst ? 'Yes' : 'No'}`
        ];

        if (this.repository.organization) {
            lines.push(`Organization: ${this.repository.organization}`);
        }

        if (this.repository.lastBuildTime) {
            lines.push(`Last Build: ${this.repository.lastBuildTime.toLocaleString()}`);
        }

        return lines.join('\n');
    }

    private getIcon(): vscode.ThemeIcon {
        if (!this.repository.hasLst) {
            return new vscode.ThemeIcon('repo', new vscode.ThemeColor('charts.gray'));
        }

        switch (this.repository.buildStatus) {
            case BuildStatus.Success:
                return new vscode.ThemeIcon('repo', new vscode.ThemeColor('charts.green'));
            case BuildStatus.Failed:
            case BuildStatus.Error:
                return new vscode.ThemeIcon('repo', new vscode.ThemeColor('charts.red'));
            case BuildStatus.Building:
                return new vscode.ThemeIcon('loading~spin');
            default:
                return new vscode.ThemeIcon('repo');
        }
    }

    private getDescription(): string {
        const parts: string[] = [];

        if (this.repository.hasLst) {
            parts.push('LST');
        }

        if (this.repository.buildStatus === BuildStatus.Building) {
            parts.push('Building...');
        } else if (this.repository.buildStatus === BuildStatus.Failed) {
            parts.push('Build Failed');
        }

        return parts.join(' • ');
    }
}

class BuildStatusTreeItem extends TreeItem {
    constructor(private repository: Repository) {
        super(`Build Status: ${repository.buildStatus}`, vscode.TreeItemCollapsibleState.None);
        this.iconPath = this.getStatusIcon();
        this.contextValue = 'buildStatus';
    }

    private getStatusIcon(): vscode.ThemeIcon {
        switch (this.repository.buildStatus) {
            case BuildStatus.Success:
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
            case BuildStatus.Failed:
            case BuildStatus.Error:
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
            case BuildStatus.Building:
                return new vscode.ThemeIcon('loading~spin');
            default:
                return new vscode.ThemeIcon('question');
        }
    }
}

class LstStatusTreeItem extends TreeItem {
    constructor(private repository: Repository, private hasLst: boolean) {
        super(
            hasLst ? 'LST Available' : 'LST Not Built',
            vscode.TreeItemCollapsibleState.None
        );
        this.iconPath = hasLst 
            ? new vscode.ThemeIcon('database', new vscode.ThemeColor('charts.green'))
            : new vscode.ThemeIcon('database', new vscode.ThemeColor('charts.gray'));
        this.contextValue = hasLst ? 'lstAvailable' : 'lstNotBuilt';
        
        if (hasLst && repository.lastBuildTime) {
            this.description = repository.lastBuildTime.toLocaleDateString();
        }
    }
}

class LastBuildTreeItem extends TreeItem {
    constructor(private repository: Repository) {
        const lastBuild = repository.lastBuildTime!;
        super(
            `Last Build: ${lastBuild.toLocaleString()}`,
            vscode.TreeItemCollapsibleState.None
        );
        this.iconPath = new vscode.ThemeIcon('clock');
        this.contextValue = 'lastBuild';
        this.tooltip = `Built on ${lastBuild.toLocaleString()}`;
    }
}

class WelcomeTreeItem extends TreeItem {
    constructor() {
        super('No repositories configured', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('info');
        this.contextValue = 'welcome';
        this.tooltip = 'Configure repositories in settings to get started';
        this.command = {
            command: 'workbench.action.openSettings',
            title: 'Open Settings',
            arguments: ['moderne']
        };
    }
}

class ActiveRecipeTreeItem extends TreeItem {
    constructor(public readonly recipe: Recipe) {
        super(`Active: ${recipe.displayName}`, vscode.TreeItemCollapsibleState.None);
        this.tooltip = `Active recipe: ${recipe.name}\nFile: ${recipe.filePath}`;
        this.iconPath = new vscode.ThemeIcon('play', new vscode.ThemeColor('charts.green'));
        this.contextValue = 'activeRecipe';
        this.description = recipe.type;
        this.command = {
            command: 'moderne.runActiveRecipe',
            title: 'Run Active Recipe'
        };
    }
}

class RecipesTreeItem extends TreeItem {
    constructor() {
        super('Recipes', vscode.TreeItemCollapsibleState.Collapsed);
        this.tooltip = 'Discovered recipes in the workspace';
        this.iconPath = new vscode.ThemeIcon('book');
        this.contextValue = 'recipes';
    }
}

class RecipeTreeItem extends TreeItem {
    constructor(public readonly recipe: Recipe) {
        super(recipe.name, vscode.TreeItemCollapsibleState.None);
        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = 'recipe';
        this.description = recipe.type;
        this.command = {
            command: 'vscode.open',
            title: 'Open Recipe',
            arguments: [vscode.Uri.file(recipe.filePath)]
        };
    }

    private getTooltip(): string {
        const lines = [
            `Recipe: ${this.recipe.name}`,
            `Type: ${this.recipe.type}`,
            `File: ${this.recipe.filePath}`
        ];

        if (this.recipe.description) {
            lines.push(`Description: ${this.recipe.description}`);
        }

        if (this.recipe.isActive) {
            lines.push('Status: Active');
        }

        return lines.join('\n');
    }

    private getIcon(): vscode.ThemeIcon {
        const isActive = this.recipe.isActive;
        const color = isActive ? new vscode.ThemeColor('charts.green') : undefined;

        switch (this.recipe.type) {
            case 'refaster':
                return new vscode.ThemeIcon('symbol-method', color);
            case 'visitor':
                return new vscode.ThemeIcon('symbol-class', color);
            case 'yaml':
                return new vscode.ThemeIcon('symbol-file', color);
            default:
                return new vscode.ThemeIcon('file', color);
        }
    }
}

class ErrorTreeItem extends TreeItem {
    constructor(errorMessage: string) {
        super(errorMessage, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
        this.contextValue = 'error';
        this.tooltip = errorMessage;
    }
}