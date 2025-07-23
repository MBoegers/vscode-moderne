import * as vscode from 'vscode';
import { ConfigService } from './services/configService';
import { CliService } from './services/cliService';
import { RepositoryService } from './services/repositoryService';
import { RecipeService } from './services/recipeService';
import { ModerneTreeProvider } from './providers/moderneTreeProvider';
import { registerCommands } from './commands';
import { Logger } from './utils/logger';

let logger: Logger;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        // Initialize logger first
        logger = new Logger('Moderne Extension');
        logger.info('Starting Moderne extension activation...');

        // Initialize services with error handling
        logger.info('Initializing services...');
        const configService = new ConfigService(context);
        logger.info('ConfigService initialized');
        
        const cliService = new CliService(configService, logger);
        logger.info('CliService initialized');
        
        const repositoryService = new RepositoryService(cliService, logger);
        logger.info('RepositoryService initialized');
        
        const recipeService = new RecipeService(cliService, configService, logger);
        logger.info('RecipeService initialized');

        // Create service registry for dependency injection
        const services = {
            config: configService,
            cli: cliService,
            repository: repositoryService,
            recipe: recipeService,
            logger: logger
        };

        // Initialize tree data provider
        logger.info('Initializing tree data provider...');
        const treeProvider = new ModerneTreeProvider(repositoryService, recipeService, logger);
        vscode.window.registerTreeDataProvider('moderneExplorer', treeProvider);
        logger.info('Tree data provider registered');

        // Register all commands
        logger.info('Registering commands...');
        registerCommands(context, services);
        logger.info('Commands registered successfully');

        // Verify command registration
        const allCommands = await vscode.commands.getCommands(true);
        const moderneCommands = allCommands.filter(cmd => cmd.startsWith('moderne.'));
        logger.info(`Found ${moderneCommands.length} Moderne commands: ${moderneCommands.join(', ')}`);

        // Initialize status bar (non-blocking)
        initializeStatusBar(services).catch(error => {
            logger.warn('Status bar initialization failed', error);
        });

        // Perform initial CLI validation (non-blocking)
        performInitialValidation(services).catch(error => {
            logger.warn('Initial CLI validation failed', error);
        });

        logger.info('Moderne extension activated successfully');

        // Show welcome message for first-time users (non-blocking)
        showWelcomeMessage(configService).catch(error => {
            logger.warn('Welcome message failed', error);
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to activate Moderne extension: ${errorMessage}`);
        if (logger) {
            logger.error('Extension activation failed', error);
        }
    }
}

export function deactivate(): void {
    if (logger) {
        logger.info('Deactivating Moderne extension...');
        logger.dispose();
    }
}

async function initializeStatusBar(services: any): Promise<void> {
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    
    statusBarItem.text = "$(loading~spin) Moderne: Checking CLI...";
    statusBarItem.tooltip = "Moderne CLI Status";
    statusBarItem.command = 'moderne.checkCliStatus';
    statusBarItem.show();

    // Update status based on CLI availability
    try {
        const isValid = await services.cli.validateLicense();
        const activeRecipe = services.recipe.getActiveRecipe();
        
        if (isValid) {
            if (activeRecipe) {
                statusBarItem.text = `$(play) Moderne: ${activeRecipe.displayName}`;
                statusBarItem.tooltip = `Moderne CLI ready\nActive recipe: ${activeRecipe.displayName}\nClick to run recipe`;
                statusBarItem.command = 'moderne.runActiveRecipe';
            } else {
                statusBarItem.text = "$(check) Moderne: Ready";
                statusBarItem.tooltip = "Moderne CLI is configured and licensed\nClick for status details";
                statusBarItem.command = 'moderne.checkCliStatus';
            }
        } else {
            statusBarItem.text = "$(warning) Moderne: No License";
            statusBarItem.tooltip = "Moderne CLI found but no valid license\nClick for configuration";
            statusBarItem.command = 'moderne.openConfiguration';
        }
    } catch (error) {
        statusBarItem.text = "$(error) Moderne: CLI Error";
        statusBarItem.tooltip = "Moderne CLI not found or misconfigured\nClick for configuration";
        statusBarItem.command = 'moderne.openConfiguration';
    }

    // Listen for active recipe changes to update status bar
    services.recipe.onActiveRecipeChanged((recipe: any) => {
        if (recipe) {
            statusBarItem.text = `$(play) Moderne: ${recipe.displayName}`;
            statusBarItem.tooltip = `Active recipe: ${recipe.displayName}\nClick to run recipe`;
            statusBarItem.command = 'moderne.runActiveRecipe';
        } else {
            statusBarItem.text = "$(check) Moderne: Ready";
            statusBarItem.tooltip = "Moderne CLI ready\nClick for status details";
            statusBarItem.command = 'moderne.checkCliStatus';
        }
    });
}

async function performInitialValidation(services: any): Promise<void> {
    try {
        // Check CLI availability
        const version = await services.cli.checkVersion();
        services.logger.info(`Moderne CLI version: ${version}`);

        // Validate license
        const isLicensed = await services.cli.validateLicense();
        if (!isLicensed) {
            services.logger.warn('No valid Moderne license found');
        }

        // Load initial repository data
        await services.repository.refreshRepositories();

    } catch (error) {
        services.logger.warn('Initial validation failed', error);
        // Don't throw - extension should still work with limited functionality
    }
}

async function showWelcomeMessage(configService: ConfigService): Promise<void> {
    const hasShownWelcome = configService.getGlobalState('hasShownWelcome', false);
    
    if (!hasShownWelcome) {
        const response = await vscode.window.showInformationMessage(
            'Welcome to Moderne for VS Code! Would you like to configure the extension now?',
            'Configure',
            'Later'
        );

        if (response === 'Configure') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'moderne');
        }

        await configService.setGlobalState('hasShownWelcome', true);
    }
}

// Export services for testing
export interface ServiceRegistry {
    config: ConfigService;
    cli: CliService;
    repository: RepositoryService;
    recipe: RecipeService;
    logger: Logger;
}