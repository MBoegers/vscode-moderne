import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import { CliService } from './cliService';
import { ConfigService } from './configService';
import { Logger } from '../utils/logger';
import { Recipe, RecipeType, ActiveRecipe, RecipeOption, CodeContext } from '../models/recipe';

export class RecipeService {
    private cliService: CliService;
    private configService: ConfigService;
    private logger: Logger;
    private activeRecipe: Recipe | null = null;

    private _onActiveRecipeChanged = new vscode.EventEmitter<Recipe | null>();
    public readonly onActiveRecipeChanged = this._onActiveRecipeChanged.event;

    constructor(cliService: CliService, configService: ConfigService, logger: Logger) {
        this.cliService = cliService;
        this.configService = configService;
        this.logger = logger;

        // Load active recipe on startup
        this.loadActiveRecipe();
    }

    /**
     * Detect recipe type from a document
     */
    async detectRecipeType(document: vscode.TextDocument): Promise<RecipeType | null> {
        try {
            const content = document.getText();
            const fileName = path.basename(document.fileName);

            // Check for Java recipe files
            if (document.languageId === 'java') {
                // Check for Refaster patterns
                if (content.includes('@BeforeTemplate') && content.includes('@AfterTemplate')) {
                    return RecipeType.Refaster;
                }
                
                // Check for visitor-based recipes
                if (content.includes('extends Recipe') || content.includes('JavaIsoVisitor')) {
                    return RecipeType.Visitor;
                }
            }
            
            // Check for YAML recipes
            if (document.languageId === 'yaml' && content.includes('type: org.openrewrite')) {
                return RecipeType.Yaml;
            }

            return null;

        } catch (error) {
            this.logger.error('Failed to detect recipe type', error);
            return null;
        }
    }

    /**
     * Set active recipe from a document
     */
    async setActiveRecipe(document: vscode.TextDocument): Promise<void> {
        try {
            const recipeType = await this.detectRecipeType(document);
            if (!recipeType) {
                throw new Error('Document does not contain a valid recipe');
            }

            const recipe = await this.parseRecipeFromDocument(document, recipeType);
            await this.writeActiveRecipeFile(recipe);
            
            this.activeRecipe = recipe;
            this._onActiveRecipeChanged.fire(this.activeRecipe);
            
            this.logger.info(`Set active recipe: ${recipe.name}`);
            
            vscode.window.showInformationMessage(
                `Active recipe set: ${recipe.displayName}`,
                'View Details'
            ).then(selection => {
                if (selection === 'View Details') {
                    this.showRecipeDetails(recipe);
                }
            });

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to set active recipe', error);
            vscode.window.showErrorMessage(`Failed to set active recipe: ${message}`);
            throw error;
        }
    }

    /**
     * Get current active recipe
     */
    getActiveRecipe(): Recipe | null {
        return this.activeRecipe;
    }

    /**
     * Discover recipes in the workspace
     */
    async discoverRecipes(): Promise<Recipe[]> {
        const recipes: Recipe[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders) {
            return recipes;
        }

        try {
            for (const folder of workspaceFolders) {
                const folderRecipes = await this.discoverRecipesInFolder(folder.uri.fsPath);
                recipes.push(...folderRecipes);
            }
        } catch (error) {
            this.logger.error('Failed to discover recipes', error);
        }

        return recipes;
    }

    /**
     * Discover recipes in a specific folder
     */
    private async discoverRecipesInFolder(folderPath: string): Promise<Recipe[]> {
        const recipes: Recipe[] = [];

        try {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folderPath, '**/*.{java,yml,yaml}'),
                '**/node_modules/**'
            );

            for (const file of files) {
                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const recipeType = await this.detectRecipeType(document);

                    if (recipeType) {
                        const recipe = await this.parseRecipeFromDocument(document, recipeType);
                        recipe.isActive = this.activeRecipe?.id === recipe.id;
                        recipes.push(recipe);
                    }
                } catch (error) {
                    this.logger.warn(`Failed to analyze file ${file.fsPath}`, error);
                }
            }
        } catch (error) {
            this.logger.error(`Failed to discover recipes in ${folderPath}`, error);
        }

        return recipes;
    }

    /**
     * Generate recipe from code context
     */
    async generateRecipe(type: RecipeType, context: CodeContext): Promise<string> {
        try {
            this.logger.info(`Generating ${type} recipe from code context`);

            switch (type) {
                case RecipeType.Refaster:
                    return this.generateRefasterRecipe(context);
                case RecipeType.Visitor:
                    return this.generateVisitorRecipe(context);
                case RecipeType.Yaml:
                    return this.generateYamlRecipe(context);
                default:
                    throw new Error(`Unsupported recipe type: ${type}`);
            }

        } catch (error) {
            this.logger.error(`Failed to generate ${type} recipe`, error);
            throw error;
        }
    }

    /**
     * Parse recipe from document content
     */
    private async parseRecipeFromDocument(document: vscode.TextDocument, type: RecipeType): Promise<Recipe> {
        const content = document.getText();
        const fileName = path.basename(document.fileName, path.extname(document.fileName));
        
        // Extract class name and package
        const classNameMatch = content.match(/class\s+(\w+)/);
        const packageMatch = content.match(/package\s+([\w.]+);/);
        
        const className = classNameMatch ? classNameMatch[1] : fileName;
        const packageName = packageMatch ? packageMatch[1] : '';
        const qualifiedName = packageName ? `${packageName}.${className}` : className;

        // Extract required options
        const requiredOptions = this.extractRequiredOptions(content);

        // Generate recipe name based on type
        let recipeName = qualifiedName;
        if (type === RecipeType.Refaster) {
            recipeName = this.generateRefasterRecipeName(qualifiedName, content);
        }

        return {
            id: qualifiedName,
            name: recipeName,
            displayName: className,
            description: `${type.charAt(0).toUpperCase() + type.slice(1)} recipe: ${className}`,
            type,
            className: qualifiedName,
            filePath: document.fileName,
            packageName,
            requiredOptions,
            isActive: true
        };
    }

    /**
     * Extract required options from Java code
     */
    private extractRequiredOptions(content: string): RecipeOption[] {
        const options: RecipeOption[] = [];
        const optionRegex = /@Option\s*\(\s*([^)]+)\s*\)\s*\w+\s+(\w+);/g;
        
        let match;
        while ((match = optionRegex.exec(content)) !== null) {
            const optionConfig = match[1];
            const fieldName = match[2];
            
            // Parse option configuration
            const requiredMatch = optionConfig.match(/required\s*=\s*(true|false)/);
            const descriptionMatch = optionConfig.match(/description\s*=\s*"([^"]+)"/);
            
            options.push({
                name: fieldName,
                type: 'string', // Default type, could be enhanced
                description: descriptionMatch ? descriptionMatch[1] : undefined,
                required: requiredMatch ? requiredMatch[1] === 'true' : true
            });
        }
        
        return options;
    }

    /**
     * Generate Refaster recipe name
     */
    private generateRefasterRecipeName(qualifiedName: string, content: string): string {
        const isInner = content.includes('class') && content.includes('{') && content.lastIndexOf('class') > content.indexOf('{');
        const hasInner = content.split('class').length > 2;
        
        if (isInner) {
            const parts = qualifiedName.split('.');
            const className = parts.pop();
            const parentClass = parts.join('.');
            return `${parentClass}Recipes$${className}Recipe`;
        } else if (hasInner) {
            return `${qualifiedName}Recipes`;
        } else {
            return `${qualifiedName}Recipe`;
        }
    }

    /**
     * Write active recipe file
     */
    private async writeActiveRecipeFile(recipe: Recipe): Promise<void> {
        const activeRecipeFile = this.configService.getActiveRecipeFilePath();
        const activeRecipeDir = path.dirname(activeRecipeFile);

        // Ensure directory exists
        await fs.ensureDir(activeRecipeDir);

        // Get workspace classpath
        const classpath = await this.getWorkspaceClasspath();
        const javaHome = await this.getJavaHome();

        // Create active recipe content
        const activeRecipeData: ActiveRecipe = {
            recipe: recipe.name,
            classpath: classpath.join(','),
            requiredOptions: recipe.requiredOptions
                .filter(opt => opt.required)
                .map(opt => opt.name)
                .join(','),
            javaHome,
            timestamp: new Date()
        };

        // Write as properties file
        const properties = [
            `recipe=${activeRecipeData.recipe}`,
            `classpath=${activeRecipeData.classpath}`,
            ...(activeRecipeData.requiredOptions ? [`required.options=${activeRecipeData.requiredOptions}`] : []),
            ...(activeRecipeData.javaHome ? [`java.home=${activeRecipeData.javaHome}`] : [])
        ];

        await fs.writeFile(activeRecipeFile, properties.join('\n'));
        this.logger.debug(`Active recipe file written: ${activeRecipeFile}`);
    }

    /**
     * Load active recipe from file
     */
    private async loadActiveRecipe(): Promise<void> {
        try {
            const activeRecipeFile = this.configService.getActiveRecipeFilePath();
            
            if (await fs.pathExists(activeRecipeFile)) {
                const content = await fs.readFile(activeRecipeFile, 'utf8');
                // Parse properties and create recipe object
                // This is a simplified implementation
                this.logger.debug('Loaded active recipe from file');
            }
        } catch (error) {
            this.logger.debug('No active recipe file found or failed to load');
        }
    }

    /**
     * Get workspace classpath
     */
    private async getWorkspaceClasspath(): Promise<string[]> {
        const classpath: string[] = [];
        
        // This would integrate with Java extension to get actual classpath
        // For now, return basic workspace paths
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            classpath.push(...workspaceFolders.map(folder => folder.uri.fsPath));
        }
        
        return classpath;
    }

    /**
     * Get Java home path
     */
    private async getJavaHome(): Promise<string | undefined> {
        // Try to get from Java extension configuration
        const javaConfig = vscode.workspace.getConfiguration('java');
        const javaHome = javaConfig.get<string>('home');
        
        if (javaHome) {
            return javaHome;
        }
        
        // Fallback to JAVA_HOME environment variable
        return process.env.JAVA_HOME;
    }

    /**
     * Show recipe details
     */
    private async showRecipeDetails(recipe: Recipe): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'recipeDetails',
            `Recipe: ${recipe.displayName}`,
            vscode.ViewColumn.Two,
            {}
        );

        panel.webview.html = this.getRecipeDetailsHtml(recipe);
    }

    /**
     * Generate HTML for recipe details
     */
    private getRecipeDetailsHtml(recipe: Recipe): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Recipe Details</title>
                <style>
                    body { font-family: var(--vscode-font-family); }
                    .property { margin: 10px 0; }
                    .label { font-weight: bold; }
                    .code { font-family: monospace; background: var(--vscode-editor-background); padding: 5px; }
                </style>
            </head>
            <body>
                <h1>${recipe.displayName}</h1>
                <div class="property">
                    <span class="label">Type:</span> ${recipe.type}
                </div>
                <div class="property">
                    <span class="label">Class:</span> <span class="code">${recipe.className}</span>
                </div>
                <div class="property">
                    <span class="label">Description:</span> ${recipe.description}
                </div>
                <div class="property">
                    <span class="label">File:</span> ${recipe.filePath}
                </div>
                ${recipe.requiredOptions.length > 0 ? `
                <div class="property">
                    <span class="label">Required Options:</span>
                    <ul>
                        ${recipe.requiredOptions.map(opt => `<li>${opt.name} (${opt.type})</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            </body>
            </html>
        `;
    }

    /**
     * Generate Refaster recipe template
     */
    private generateRefasterRecipe(context: CodeContext): string {
        const className = `${context.className || 'Generated'}Recipe`;
        
        return `package ${context.packageName || 'com.example'};

import org.openrewrite.java.template.RecipeDescriptor;
import com.google.errorprone.refaster.annotation.AfterTemplate;
import com.google.errorprone.refaster.annotation.BeforeTemplate;

@RecipeDescriptor(
    name = "${className}",
    description = "Generated Refaster recipe"
)
public class ${className} {
    
    @BeforeTemplate
    void before() {
        ${context.selectedText}
    }
    
    @AfterTemplate
    void after() {
        // TODO: Define the replacement pattern
    }
}`;
    }

    /**
     * Generate visitor-based recipe template
     */
    private generateVisitorRecipe(context: CodeContext): string {
        const className = `${context.className || 'Generated'}Recipe`;
        
        return `package ${context.packageName || 'com.example'};

import org.openrewrite.*;
import org.openrewrite.java.JavaIsoVisitor;
import org.openrewrite.java.tree.J;

public class ${className} extends Recipe {
    
    @Override
    public String getDisplayName() {
        return "${className}";
    }
    
    @Override
    public String getDescription() {
        return "Generated visitor-based recipe";
    }
    
    @Override
    public TreeVisitor<?, ExecutionContext> getVisitor() {
        return new JavaIsoVisitor<ExecutionContext>() {
            // TODO: Implement visitor logic
        };
    }
}`;
    }

    /**
     * Generate YAML recipe template
     */
    private generateYamlRecipe(context: CodeContext): string {
        return `---
type: specs.openrewrite.org/v1beta/recipe
name: com.example.GeneratedRecipe
displayName: Generated Recipe
description: Generated YAML recipe

recipeList: []
# TODO: Define recipe steps
`;
    }
}