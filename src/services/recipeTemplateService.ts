import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import { Logger } from '../utils/logger';

export interface RecipeTemplate {
    id: string;
    name: string;
    description: string;
    category: RecipeCategory;
    type: 'refaster' | 'visitor' | 'yaml' | 'hybrid';
    complexity: 'beginner' | 'intermediate' | 'advanced';
    tags: string[];
    template: string;
    placeholders: RecipePlaceholder[];
    examples: RecipeExample[];
    prerequisites?: string[];
    metadata: RecipeTemplateMetadata;
}

export interface RecipePlaceholder {
    id: string;
    name: string;
    description: string;
    type: 'string' | 'class' | 'method' | 'annotation' | 'expression' | 'type';
    required: boolean;
    defaultValue?: string;
    validation?: PlaceholderValidation;
    suggestions?: string[];
}

export interface PlaceholderValidation {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    customValidator?: string; // JavaScript function as string
}

export interface RecipeExample {
    title: string;
    description: string;
    beforeCode: string;
    afterCode: string;
    placeholderValues: Record<string, string>;
}

export interface RecipeTemplateMetadata {
    author: string;
    version: string;
    lastModified: Date;
    usageCount: number;
    averageRating: number;
    applicableFrameworks: string[];
    javaVersions: string[];
    dependencies: string[];
}

export enum RecipeCategory {
    MIGRATION = 'migration',
    MODERNIZATION = 'modernization',
    BEST_PRACTICES = 'best-practices',
    SECURITY = 'security',
    PERFORMANCE = 'performance',
    TESTING = 'testing',
    CLEANUP = 'cleanup',
    CUSTOM = 'custom'
}

export interface GeneratedRecipe {
    content: string;
    filePath: string;
    type: RecipeTemplate['type'];
    metadata: {
        templateId: string;
        generatedAt: Date;
        placeholderValues: Record<string, string>;
    };
}

export interface RecipeGenerationContext {
    workspaceRoot: string;
    targetCode?: string;
    language: string;
    framework?: string;
    selectedText?: string;
    filePath?: string;
    projectType?: string;
}

export class RecipeTemplateService {
    private templates = new Map<string, RecipeTemplate>();
    private customTemplates = new Map<string, RecipeTemplate>();
    private generationHistory: GeneratedRecipe[] = [];

    private readonly _onDidAddTemplate = new vscode.EventEmitter<RecipeTemplate>();
    private readonly _onDidUpdateTemplate = new vscode.EventEmitter<RecipeTemplate>();
    private readonly _onDidGenerateRecipe = new vscode.EventEmitter<GeneratedRecipe>();

    readonly onDidAddTemplate = this._onDidAddTemplate.event;
    readonly onDidUpdateTemplate = this._onDidUpdateTemplate.event;
    readonly onDidGenerateRecipe = this._onDidGenerateRecipe.event;

    constructor(private logger: Logger) {
        this.loadBuiltInTemplates();
        this.loadCustomTemplates();
    }

    private loadBuiltInTemplates(): void {
        // Java Migration Templates
        this.registerTemplate({
            id: 'java-8-to-11-migration',
            name: 'Java 8 to 11 Migration',
            description: 'Migrate Java 8 code patterns to Java 11 equivalents',
            category: RecipeCategory.MIGRATION,
            type: 'visitor',
            complexity: 'intermediate',
            tags: ['java', 'migration', 'java-11'],
            template: this.getJava8To11Template(),
            placeholders: [
                {
                    id: 'targetClass',
                    name: 'Target Class Pattern',
                    description: 'Pattern to match classes for migration',
                    type: 'class',
                    required: true,
                    defaultValue: '*',
                    suggestions: ['com.example.*', '*.util.*', 'org.springframework.*']
                }
            ],
            examples: [
                {
                    title: 'Optional.orElse to Optional.orElseGet',
                    description: 'Convert Optional.orElse() calls to orElseGet() when appropriate',
                    beforeCode: 'optional.orElse(new ArrayList<>())',
                    afterCode: 'optional.orElseGet(ArrayList::new)',
                    placeholderValues: { targetClass: '*' }
                }
            ],
            prerequisites: ['Java 11+ target'],
            metadata: {
                author: 'Moderne',
                version: '1.0.0',
                lastModified: new Date(),
                usageCount: 0,
                averageRating: 0,
                applicableFrameworks: ['spring', 'junit'],
                javaVersions: ['11', '17', '21'],
                dependencies: []
            }
        });

        // Spring Boot Migration Template
        this.registerTemplate({
            id: 'spring-boot-2-to-3',
            name: 'Spring Boot 2 to 3 Migration',
            description: 'Migrate Spring Boot 2.x applications to Spring Boot 3.x',
            category: RecipeCategory.MIGRATION,
            type: 'yaml',
            complexity: 'advanced',
            tags: ['spring-boot', 'migration', 'spring-boot-3'],
            template: this.getSpringBoot2To3Template(),
            placeholders: [
                {
                    id: 'packagePattern',
                    name: 'Package Pattern',
                    description: 'Package pattern to apply migrations to',
                    type: 'string',
                    required: true,
                    defaultValue: 'com.example',
                    validation: {
                        pattern: '^[a-z]+(\\.[a-z]+)*$'
                    }
                }
            ],
            examples: [
                {
                    title: 'Security Configuration Migration',
                    description: 'Update Spring Security configuration for Spring Boot 3',
                    beforeCode: '@EnableWebSecurity\npublic class SecurityConfig extends WebSecurityConfigurerAdapter',
                    afterCode: '@EnableWebSecurity\npublic class SecurityConfig',
                    placeholderValues: { packagePattern: 'com.example' }
                }
            ],
            prerequisites: ['Spring Boot 3.x compatibility'],
            metadata: {
                author: 'Moderne',
                version: '1.0.0',
                lastModified: new Date(),
                usageCount: 0,
                averageRating: 0,
                applicableFrameworks: ['spring-boot'],
                javaVersions: ['17', '21'],
                dependencies: ['spring-boot-starter']
            }
        });

        // Refaster Template for Common Patterns
        this.registerTemplate({
            id: 'string-builder-optimization',
            name: 'StringBuilder Optimization',
            description: 'Convert string concatenation to StringBuilder',
            category: RecipeCategory.PERFORMANCE,
            type: 'refaster',
            complexity: 'beginner',
            tags: ['performance', 'string', 'optimization'],
            template: this.getStringBuilderTemplate(),
            placeholders: [
                {
                    id: 'minConcatenations',
                    name: 'Minimum Concatenations',
                    description: 'Minimum number of concatenations to trigger optimization',
                    type: 'string',
                    required: false,
                    defaultValue: '3',
                    validation: {
                        pattern: '^[0-9]+$',
                        minLength: 1,
                        maxLength: 2
                    }
                }
            ],
            examples: [
                {
                    title: 'String concatenation optimization',
                    description: 'Replace multiple string concatenations with StringBuilder',
                    beforeCode: 'String result = a + b + c + d;',
                    afterCode: 'String result = new StringBuilder().append(a).append(b).append(c).append(d).toString();',
                    placeholderValues: { minConcatenations: '3' }
                }
            ],
            prerequisites: [],
            metadata: {
                author: 'Moderne',
                version: '1.0.0',
                lastModified: new Date(),
                usageCount: 0,
                averageRating: 0,
                applicableFrameworks: [],
                javaVersions: ['8', '11', '17', '21'],
                dependencies: []
            }
        });

        // Security Best Practices Template
        this.registerTemplate({
            id: 'secure-random-usage',
            name: 'Secure Random Usage',
            description: 'Replace insecure random number generation with SecureRandom',
            category: RecipeCategory.SECURITY,
            type: 'refaster',
            complexity: 'beginner',
            tags: ['security', 'random', 'cryptography'],
            template: this.getSecureRandomTemplate(),
            placeholders: [],
            examples: [
                {
                    title: 'Replace Random with SecureRandom',
                    description: 'Use SecureRandom for cryptographically secure random numbers',
                    beforeCode: 'Random random = new Random();\nint value = random.nextInt();',
                    afterCode: 'SecureRandom random = new SecureRandom();\nint value = random.nextInt();',
                    placeholderValues: {}
                }
            ],
            prerequisites: [],
            metadata: {
                author: 'Moderne',
                version: '1.0.0',
                lastModified: new Date(),
                usageCount: 0,
                averageRating: 0,
                applicableFrameworks: [],
                javaVersions: ['8', '11', '17', '21'],
                dependencies: []
            }
        });
    }

    private async loadCustomTemplates(): Promise<void> {
        try {
            const templatesDir = this.getTemplatesDirectory();
            if (await fs.pathExists(templatesDir)) {
                const files = await fs.readdir(templatesDir);
                
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        try {
                            const templatePath = path.join(templatesDir, file);
                            const templateData = await fs.readJson(templatePath);
                            const template = this.validateTemplate(templateData);
                            this.customTemplates.set(template.id, template);
                        } catch (error) {
                            this.logger.warn(`Failed to load template ${file}: ${error}`);
                        }
                    }
                }

                this.logger.info(`Loaded ${this.customTemplates.size} custom templates`);
            }
        } catch (error) {
            this.logger.error(`Failed to load custom templates: ${error}`);
        }
    }

    private getTemplatesDirectory(): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            return path.join(workspaceFolder.uri.fsPath, '.vscode', 'moderne', 'templates');
        }
        return path.join(process.cwd(), '.vscode', 'moderne', 'templates');
    }

    private validateTemplate(data: any): RecipeTemplate {
        // Basic validation - in production, use a proper schema validator
        if (!data.id || !data.name || !data.template) {
            throw new Error('Invalid template: missing required fields');
        }

        return {
            ...data,
            lastModified: new Date(data.lastModified || Date.now()),
            placeholders: data.placeholders || [],
            examples: data.examples || [],
            metadata: {
                ...data.metadata,
                lastModified: new Date(data.metadata?.lastModified || Date.now())
            }
        };
    }

    // Template generation methods
    async generateRecipe(
        templateId: string,
        placeholderValues: Record<string, string>,
        context: RecipeGenerationContext
    ): Promise<GeneratedRecipe> {
        const template = this.getTemplate(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        // Validate placeholder values
        this.validatePlaceholderValues(template, placeholderValues);

        // Generate recipe content
        const content = await this.processTemplate(template, placeholderValues, context);

        // Determine output file path
        const filePath = this.generateOutputPath(template, context);

        const generatedRecipe: GeneratedRecipe = {
            content,
            filePath,
            type: template.type,
            metadata: {
                templateId,
                generatedAt: new Date(),
                placeholderValues
            }
        };

        // Update usage statistics
        template.metadata.usageCount++;
        await this.saveTemplate(template);

        // Store in history
        this.generationHistory.push(generatedRecipe);

        this._onDidGenerateRecipe.fire(generatedRecipe);
        return generatedRecipe;
    }

    private validatePlaceholderValues(
        template: RecipeTemplate,
        values: Record<string, string>
    ): void {
        for (const placeholder of template.placeholders) {
            const value = values[placeholder.id];

            if (placeholder.required && (!value || value.trim() === '')) {
                throw new Error(`Required placeholder '${placeholder.name}' is missing`);
            }

            if (value && placeholder.validation) {
                this.validatePlaceholderValue(placeholder, value);
            }
        }
    }

    private validatePlaceholderValue(placeholder: RecipePlaceholder, value: string): void {
        const validation = placeholder.validation!;

        if (validation.pattern) {
            const regex = new RegExp(validation.pattern);
            if (!regex.test(value)) {
                throw new Error(`Invalid value for '${placeholder.name}': does not match pattern ${validation.pattern}`);
            }
        }

        if (validation.minLength && value.length < validation.minLength) {
            throw new Error(`Invalid value for '${placeholder.name}': minimum length is ${validation.minLength}`);
        }

        if (validation.maxLength && value.length > validation.maxLength) {
            throw new Error(`Invalid value for '${placeholder.name}': maximum length is ${validation.maxLength}`);
        }

        if (validation.customValidator) {
            try {
                const validator = new Function('value', validation.customValidator);
                const result = validator(value);
                if (!result) {
                    throw new Error(`Custom validation failed for '${placeholder.name}'`);
                }
            } catch (error) {
                throw new Error(`Validation error for '${placeholder.name}': ${error}`);
            }
        }
    }

    private async processTemplate(
        template: RecipeTemplate,
        values: Record<string, string>,
        context: RecipeGenerationContext
    ): Promise<string> {
        let content = template.template;

        // Replace placeholders
        for (const placeholder of template.placeholders) {
            const value = values[placeholder.id] || placeholder.defaultValue || '';
            const pattern = new RegExp(`\\{\\{${placeholder.id}\\}\\}`, 'g');
            content = content.replace(pattern, value);
        }

        // Process context-based replacements
        content = await this.processContextualReplacements(content, context);

        // Apply intelligent transformations
        content = await this.applyIntelligentTransformations(content, template, context);

        return content;
    }

    private async processContextualReplacements(
        content: string,
        context: RecipeGenerationContext
    ): Promise<string> {
        // Replace context variables
        const replacements = {
            '{{PACKAGE_NAME}}': this.extractPackageName(context),
            '{{CLASS_NAME}}': this.extractClassName(context),
            '{{WORKSPACE_ROOT}}': context.workspaceRoot,
            '{{LANGUAGE}}': context.language,
            '{{FRAMEWORK}}': context.framework || '',
            '{{PROJECT_TYPE}}': context.projectType || ''
        };

        let processedContent = content;
        for (const [placeholder, value] of Object.entries(replacements)) {
            processedContent = processedContent.replace(new RegExp(placeholder, 'g'), value);
        }

        return processedContent;
    }

    private extractPackageName(context: RecipeGenerationContext): string {
        if (context.filePath) {
            const srcIndex = context.filePath.indexOf('/src/main/java/');
            if (srcIndex !== -1) {
                const packagePath = context.filePath.substring(srcIndex + '/src/main/java/'.length);
                const packageDir = path.dirname(packagePath);
                return packageDir.replace(/\//g, '.');
            }
        }
        return 'com.example';
    }

    private extractClassName(context: RecipeGenerationContext): string {
        if (context.filePath) {
            const fileName = path.basename(context.filePath, '.java');
            return fileName;
        }
        return 'Example';
    }

    private async applyIntelligentTransformations(
        content: string,
        template: RecipeTemplate,
        context: RecipeGenerationContext
    ): Promise<string> {
        // Apply template-specific intelligent transformations
        switch (template.type) {
            case 'refaster':
                return this.optimizeRefasterTemplate(content, context);
            case 'visitor':
                return this.optimizeVisitorTemplate(content, context);
            case 'yaml':
                return this.optimizeYamlTemplate(content, context);
            default:
                return content;
        }
    }

    private optimizeRefasterTemplate(content: string, context: RecipeGenerationContext): string {
        // Add intelligent optimizations for Refaster templates
        // - Optimize import statements
        // - Add null checks where appropriate
        // - Optimize generic type handling
        
        return content;
    }

    private optimizeVisitorTemplate(content: string, context: RecipeGenerationContext): string {
        // Add intelligent optimizations for Visitor templates
        // - Add appropriate visitor methods
        // - Optimize AST traversal
        // - Add error handling
        
        return content;
    }

    private optimizeYamlTemplate(content: string, context: RecipeGenerationContext): string {
        // Add intelligent optimizations for YAML templates
        // - Validate YAML structure
        // - Optimize recipe composition
        // - Add appropriate metadata
        
        return content;
    }

    private generateOutputPath(template: RecipeTemplate, context: RecipeGenerationContext): string {
        const recipesDir = path.join(context.workspaceRoot, 'src', 'main', 'resources', 'META-INF', 'rewrite');
        
        let fileName: string;
        switch (template.type) {
            case 'refaster':
                fileName = `${template.name.replace(/\s+/g, '')}Refaster.java`;
                break;
            case 'visitor':
                fileName = `${template.name.replace(/\s+/g, '')}Visitor.java`;
                break;
            case 'yaml':
                fileName = `${template.name.replace(/\s+/g, '').toLowerCase()}.yml`;
                break;
            default:
                fileName = `${template.name.replace(/\s+/g, '')}.java`;
        }

        return path.join(recipesDir, fileName);
    }

    // Template management
    registerTemplate(template: RecipeTemplate): void {
        this.templates.set(template.id, template);
        this._onDidAddTemplate.fire(template);
        this.logger.info(`Registered template: ${template.name}`);
    }

    async saveCustomTemplate(template: RecipeTemplate): Promise<void> {
        const templatesDir = this.getTemplatesDirectory();
        await fs.ensureDir(templatesDir);

        const templatePath = path.join(templatesDir, `${template.id}.json`);
        await fs.writeJson(templatePath, template, { spaces: 2 });

        this.customTemplates.set(template.id, template);
        this._onDidAddTemplate.fire(template);
    }

    private async saveTemplate(template: RecipeTemplate): Promise<void> {
        if (this.customTemplates.has(template.id)) {
            await this.saveCustomTemplate(template);
        }
        // Built-in templates are not saved to disk
    }

    // Template content definitions
    private getJava8To11Template(): string {
        return `
package {{PACKAGE_NAME}};

import org.openrewrite.ExecutionContext;
import org.openrewrite.Recipe;
import org.openrewrite.RecipeDescriptor;
import org.openrewrite.java.JavaIsoVisitor;
import org.openrewrite.java.tree.J;

@RecipeDescriptor(
    name = "Java 8 to 11 Migration",
    displayName = "Migrate Java 8 patterns to Java 11",
    description = "Applies various transformations to modernize Java 8 code for Java 11"
)
public class Java8To11Migration extends Recipe {
    
    @Override
    protected JavaIsoVisitor<ExecutionContext> getVisitor() {
        return new JavaIsoVisitor<ExecutionContext>() {
            @Override
            public J.MethodInvocation visitMethodInvocation(J.MethodInvocation method, ExecutionContext ctx) {
                // Apply Java 8 to 11 transformations
                if (isTargetClass(method)) {
                    return modernizeMethodCall(method);
                }
                return super.visitMethodInvocation(method, ctx);
            }
            
            private boolean isTargetClass(J.MethodInvocation method) {
                return method.getSelect() != null && 
                       method.getSelect().toString().matches("{{targetClass}}");
            }
            
            private J.MethodInvocation modernizeMethodCall(J.MethodInvocation method) {
                // Implementation for modernizing method calls
                return method;
            }
        };
    }
}
        `.trim();
    }

    private getSpringBoot2To3Template(): string {
        return `
---
type: specs.openrewrite.org/v1beta/recipe
name: com.example.SpringBoot2To3Migration
displayName: Spring Boot 2 to 3 Migration
description: Migrates Spring Boot 2.x applications to Spring Boot 3.x
tags:
  - spring
  - spring-boot
  - migration
recipeList:
  - org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_0
  - org.openrewrite.java.spring.security6.UpgradeSprinSecurity_6_0
  - org.openrewrite.java.migrate.javax.JavaxMigrationToJakarta
preconditions:
  - org.openrewrite.maven.MavenDownloadingExceptions
  - org.openrewrite.java.dependencies.DependencyInsight:
      groupIdPattern: org.springframework.boot
      artifactIdPattern: spring-boot-starter*
      version: "2\\\\.*"
      scope: compile
---
type: specs.openrewrite.org/v1beta/recipe  
name: com.example.CustomSecurityConfiguration
displayName: Update Security Configuration for Spring Boot 3
description: Updates security configuration classes for Spring Boot 3 compatibility
recipeList:
  - org.openrewrite.java.ChangeType:
      oldFullyQualifiedTypeName: org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter
      newFullyQualifiedTypeName: org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
preconditions:
  - org.openrewrite.java.search.HasType:
      fullyQualifiedTypeName: org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter
        `.trim();
    }

    private getStringBuilderTemplate(): string {
        return `
package {{PACKAGE_NAME}};

import com.google.errorprone.refaster.annotation.AfterTemplate;
import com.google.errorprone.refaster.annotation.BeforeTemplate;
import com.google.errorprone.refaster.annotation.Placeholder;

public class StringBuilderOptimization {
    
    @BeforeTemplate
    String concatenateStrings(@Placeholder String a, @Placeholder String b, @Placeholder String c) {
        return a + b + c;
    }
    
    @AfterTemplate
    String concatenateStringsOptimized(@Placeholder String a, @Placeholder String b, @Placeholder String c) {
        return new StringBuilder()
            .append(a)
            .append(b)
            .append(c)
            .toString();
    }
    
    @BeforeTemplate
    String concatenateMultipleStrings(@Placeholder String... strings) {
        String result = "";
        for (String s : strings) {
            result += s;
        }
        return result;
    }
    
    @AfterTemplate
    String concatenateMultipleStringsOptimized(@Placeholder String... strings) {
        StringBuilder sb = new StringBuilder();
        for (String s : strings) {
            sb.append(s);
        }
        return sb.toString();
    }
}
        `.trim();
    }

    private getSecureRandomTemplate(): string {
        return `
package {{PACKAGE_NAME}};

import com.google.errorprone.refaster.annotation.AfterTemplate;
import com.google.errorprone.refaster.annotation.BeforeTemplate;
import java.util.Random;
import java.security.SecureRandom;

public class SecureRandomUsage {
    
    @BeforeTemplate
    Random createRandom() {
        return new Random();
    }
    
    @AfterTemplate
    SecureRandom createSecureRandom() {
        return new SecureRandom();
    }
    
    @BeforeTemplate
    Random createRandomWithSeed(long seed) {
        return new Random(seed);
    }
    
    @AfterTemplate
    SecureRandom createSecureRandomWithSeed(long seed) {
        SecureRandom random = new SecureRandom();
        random.setSeed(seed);
        return random;
    }
}
        `.trim();
    }

    // Public API
    getTemplate(id: string): RecipeTemplate | undefined {
        return this.templates.get(id) || this.customTemplates.get(id);
    }

    getAllTemplates(): RecipeTemplate[] {
        return [
            ...Array.from(this.templates.values()),
            ...Array.from(this.customTemplates.values())
        ];
    }

    getTemplatesByCategory(category: RecipeCategory): RecipeTemplate[] {
        return this.getAllTemplates().filter(template => template.category === category);
    }

    searchTemplates(query: string): RecipeTemplate[] {
        const queryLower = query.toLowerCase();
        return this.getAllTemplates().filter(template =>
            template.name.toLowerCase().includes(queryLower) ||
            template.description.toLowerCase().includes(queryLower) ||
            template.tags.some(tag => tag.toLowerCase().includes(queryLower))
        );
    }

    getGenerationHistory(): GeneratedRecipe[] {
        return [...this.generationHistory];
    }

    clearHistory(): void {
        this.generationHistory = [];
    }

    dispose(): void {
        this._onDidAddTemplate.dispose();
        this._onDidUpdateTemplate.dispose();
        this._onDidGenerateRecipe.dispose();
    }
}