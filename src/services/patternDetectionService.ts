import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { CliService } from './cliService';
import { CacheService } from './cacheService';

export interface CodePattern {
    id: string;
    name: string;
    description: string;
    confidence: number; // 0-100
    category: PatternCategory;
    complexity: 'simple' | 'moderate' | 'complex';
    codeSnippet: string;
    location: PatternLocation;
    suggestedRecipes: string[];
    metadata: PatternMetadata;
}

export interface PatternLocation {
    filePath: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
}

export interface PatternMetadata {
    language: string;
    framework?: string;
    antiPattern: boolean;
    performanceImpact: 'none' | 'low' | 'medium' | 'high';
    securityImpact: 'none' | 'low' | 'medium' | 'high';
    maintainabilityImpact: 'none' | 'low' | 'medium' | 'high';
    estimatedInstances: number;
    lastDetected: Date;
}

export enum PatternCategory {
    ANTI_PATTERN = 'anti-pattern',
    BEST_PRACTICE = 'best-practice',
    PERFORMANCE = 'performance',
    SECURITY = 'security',
    MAINTAINABILITY = 'maintainability',
    MODERNIZATION = 'modernization',
    FRAMEWORK_SPECIFIC = 'framework-specific',
    DESIGN_PATTERN = 'design-pattern'
}

export interface PatternAnalysisRequest {
    filePath?: string;
    codeContent?: string;
    language: string;
    framework?: string;
    analysisDepth: 'quick' | 'thorough' | 'deep';
    includeContext: boolean;
}

export interface PatternAnalysisResult {
    patterns: CodePattern[];
    summary: AnalysisSummary;
    recommendations: PatternRecommendation[];
    executionTime: number;
}

export interface AnalysisSummary {
    totalPatterns: number;
    patternsByCategory: Record<PatternCategory, number>;
    highConfidencePatterns: number;
    criticalIssues: number;
    estimatedRefactoringEffort: 'low' | 'medium' | 'high';
}

export interface PatternRecommendation {
    patternId: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    rationale: string;
    suggestedActions: string[];
    estimatedEffort: string;
    potentialBenefits: string[];
}

export interface LearningFeedback {
    patternId: string;
    userConfirmation: 'correct' | 'incorrect' | 'partially_correct';
    userComment?: string;
    actualPattern?: string;
    timestamp: Date;
}

export class PatternDetectionService {
    private detectedPatterns = new Map<string, CodePattern[]>();
    private patternDefinitions = new Map<string, PatternDefinition>();
    private learningData: LearningFeedback[] = [];
    private analysisCache = new Map<string, PatternAnalysisResult>();

    private readonly _onDidDetectPatterns = new vscode.EventEmitter<PatternAnalysisResult>();
    private readonly _onDidLearnFromFeedback = new vscode.EventEmitter<LearningFeedback>();

    readonly onDidDetectPatterns = this._onDidDetectPatterns.event;
    readonly onDidLearnFromFeedback = this._onDidLearnFromFeedback.event;

    constructor(
        private cliService: CliService,
        private cacheService: CacheService,
        private logger: Logger
    ) {
        this.initializePatternDefinitions();
    }

    private initializePatternDefinitions(): void {
        // Initialize built-in pattern definitions
        this.registerPatternDefinition({
            id: 'string-concatenation-loop',
            name: 'String Concatenation in Loop',
            description: 'String concatenation inside loops can cause performance issues',
            category: PatternCategory.PERFORMANCE,
            patterns: [
                /for\s*\([^)]*\)\s*\{[^}]*\+\s*=.*string/gi,
                /while\s*\([^)]*\)\s*\{[^}]*\+\s*=.*string/gi
            ],
            confidence: 85,
            suggestedRecipes: ['string-builder-optimization'],
            metadata: {
                performanceImpact: 'high',
                complexity: 'simple'
            }
        });

        this.registerPatternDefinition({
            id: 'insecure-random',
            name: 'Insecure Random Number Generation',
            description: 'Using java.util.Random for security-sensitive operations',
            category: PatternCategory.SECURITY,
            patterns: [
                /new\s+Random\s*\(\s*\)/gi,
                /Random\s+\w+\s*=\s*new\s+Random/gi
            ],
            confidence: 90,
            suggestedRecipes: ['secure-random-usage'],
            metadata: {
                securityImpact: 'high',
                complexity: 'simple'
            }
        });

        this.registerPatternDefinition({
            id: 'resource-leak',
            name: 'Potential Resource Leak',
            description: 'Resources that might not be properly closed',
            category: PatternCategory.ANTI_PATTERN,
            patterns: [
                /new\s+FileInputStream\s*\([^)]*\)(?!.*try-with-resources)/gi,
                /new\s+FileOutputStream\s*\([^)]*\)(?!.*try-with-resources)/gi,
                /\.getConnection\s*\([^)]*\)(?!.*try-with-resources)/gi
            ],
            confidence: 75,
            suggestedRecipes: ['try-with-resources'],
            metadata: {
                maintainabilityImpact: 'high',
                complexity: 'moderate'
            }
        });

        this.registerPatternDefinition({
            id: 'deprecated-api-usage',
            name: 'Deprecated API Usage',
            description: 'Usage of deprecated APIs that should be modernized',
            category: PatternCategory.MODERNIZATION,
            patterns: [
                /@Deprecated/gi,
                /Vector\s*</gi,
                /Hashtable\s*</gi,
                /StringBuffer/gi
            ],
            confidence: 95,
            suggestedRecipes: ['modernize-deprecated-apis'],
            metadata: {
                maintainabilityImpact: 'medium',
                complexity: 'simple'
            }
        });

        this.registerPatternDefinition({
            id: 'empty-catch-block',
            name: 'Empty Catch Block',
            description: 'Catch blocks that silently ignore exceptions',
            category: PatternCategory.ANTI_PATTERN,
            patterns: [
                /catch\s*\([^)]*\)\s*\{\s*\}/gi,
                /catch\s*\([^)]*\)\s*\{\s*\/\/[^}]*\}/gi
            ],
            confidence: 80,
            suggestedRecipes: ['proper-exception-handling'],
            metadata: {
                maintainabilityImpact: 'high',
                complexity: 'simple'
            }
        });

        this.registerPatternDefinition({
            id: 'spring-security-config-adapter',
            name: 'WebSecurityConfigurerAdapter Usage',
            description: 'Usage of deprecated WebSecurityConfigurerAdapter in Spring Security',
            category: PatternCategory.FRAMEWORK_SPECIFIC,
            patterns: [
                /extends\s+WebSecurityConfigurerAdapter/gi,
                /WebSecurityConfigurerAdapter/gi
            ],
            confidence: 95,
            suggestedRecipes: ['spring-security-6-migration'],
            metadata: {
                framework: 'spring-security',
                maintainabilityImpact: 'medium',
                complexity: 'moderate'
            }
        });

        this.logger.info(`Initialized ${this.patternDefinitions.size} pattern definitions`);
    }

    private registerPatternDefinition(definition: PatternDefinition): void {
        this.patternDefinitions.set(definition.id, definition);
    }

    async analyzeCode(request: PatternAnalysisRequest): Promise<PatternAnalysisResult> {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(request);

        // Check cache first
        const cached = this.analysisCache.get(cacheKey);
        if (cached && Date.now() - cached.executionTime < 300000) { // 5 minutes cache
            return cached;
        }

        try {
            this.logger.info(`Starting pattern analysis for ${request.filePath || 'code snippet'}`);

            let codeContent = request.codeContent;
            if (!codeContent && request.filePath) {
                codeContent = await this.readFileContent(request.filePath);
            }

            if (!codeContent) {
                throw new Error('No code content provided for analysis');
            }

            const patterns = await this.detectPatterns(codeContent, request);
            const summary = this.generateSummary(patterns);
            const recommendations = this.generateRecommendations(patterns);

            const result: PatternAnalysisResult = {
                patterns,
                summary,
                recommendations,
                executionTime: Date.now() - startTime
            };

            // Cache the result
            this.analysisCache.set(cacheKey, result);

            // Store patterns for the file
            if (request.filePath) {
                this.detectedPatterns.set(request.filePath, patterns);
            }

            this._onDidDetectPatterns.fire(result);
            this.logger.info(`Pattern analysis completed: found ${patterns.length} patterns`);

            return result;

        } catch (error) {
            this.logger.error(`Pattern analysis failed: ${error}`);
            throw error;
        }
    }

    private async readFileContent(filePath: string): Promise<string> {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            return document.getText();
        } catch (error) {
            throw new Error(`Failed to read file ${filePath}: ${error}`);
        }
    }

    private async detectPatterns(
        codeContent: string,
        request: PatternAnalysisRequest
    ): Promise<CodePattern[]> {
        const patterns: CodePattern[] = [];
        const lines = codeContent.split('\n');

        // Apply different detection strategies based on analysis depth
        switch (request.analysisDepth) {
            case 'quick':
                patterns.push(...await this.quickPatternDetection(codeContent, lines, request));
                break;
            case 'thorough':
                patterns.push(...await this.thoroughPatternDetection(codeContent, lines, request));
                patterns.push(...await this.semanticPatternDetection(codeContent, request));
                break;
            case 'deep':
                patterns.push(...await this.quickPatternDetection(codeContent, lines, request));
                patterns.push(...await this.thoroughPatternDetection(codeContent, lines, request));
                patterns.push(...await this.semanticPatternDetection(codeContent, request));
                patterns.push(...await this.mlBasedPatternDetection(codeContent, request));
                break;
        }

        // Apply confidence adjustments based on learning
        return this.adjustPatternsWithLearning(patterns);
    }

    private async quickPatternDetection(
        codeContent: string,
        lines: string[],
        request: PatternAnalysisRequest
    ): Promise<CodePattern[]> {
        const patterns: CodePattern[] = [];

        for (const [id, definition] of this.patternDefinitions.entries()) {
            for (const regex of definition.patterns) {
                let match;
                while ((match = regex.exec(codeContent)) !== null) {
                    const location = this.calculateLocation(match, lines);
                    
                    const pattern: CodePattern = {
                        id: `${id}-${Date.now()}-${Math.random()}`,
                        name: definition.name,
                        description: definition.description,
                        confidence: definition.confidence,
                        category: definition.category,
                        complexity: definition.metadata.complexity,
                        codeSnippet: this.extractCodeSnippet(lines, location),
                        location,
                        suggestedRecipes: definition.suggestedRecipes,
                        metadata: {
                            language: request.language,
                            framework: request.framework,
                            antiPattern: definition.category === PatternCategory.ANTI_PATTERN,
                            performanceImpact: definition.metadata.performanceImpact || 'none',
                            securityImpact: definition.metadata.securityImpact || 'none',
                            maintainabilityImpact: definition.metadata.maintainabilityImpact || 'none',
                            estimatedInstances: 1,
                            lastDetected: new Date()
                        }
                    };

                    patterns.push(pattern);
                }
                
                // Reset regex lastIndex to avoid issues with global regexes
                regex.lastIndex = 0;
            }
        }

        return patterns;
    }

    private async thoroughPatternDetection(
        codeContent: string,
        lines: string[],
        request: PatternAnalysisRequest
    ): Promise<CodePattern[]> {
        const patterns: CodePattern[] = [];

        // Add more sophisticated pattern detection logic
        patterns.push(...await this.detectComplexPatterns(codeContent, lines, request));
        patterns.push(...await this.detectFrameworkSpecificPatterns(codeContent, lines, request));
        
        return patterns;
    }

    private async detectComplexPatterns(
        codeContent: string,
        lines: string[],
        request: PatternAnalysisRequest
    ): Promise<CodePattern[]> {
        const patterns: CodePattern[] = [];

        // Detect complex anti-patterns that require multi-line analysis
        if (request.language === 'java') {
            patterns.push(...this.detectJavaComplexPatterns(codeContent, lines));
        }

        return patterns;
    }

    private detectJavaComplexPatterns(codeContent: string, lines: string[]): CodePattern[] {
        const patterns: CodePattern[] = [];

        // Detect God Class pattern
        const classMatches = codeContent.match(/class\s+\w+/g);
        if (classMatches) {
            const methodCount = (codeContent.match(/public\s+\w+.*\(/g) || []).length;
            const lineCount = lines.length;
            
            if (methodCount > 20 || lineCount > 1000) {
                patterns.push(this.createGodClassPattern(lines));
            }
        }

        // Detect Long Parameter List
        const methodSignatures = codeContent.match(/\w+\s*\([^)]{50,}\)/g);
        if (methodSignatures) {
            methodSignatures.forEach(signature => {
                const paramCount = (signature.match(/,/g) || []).length + 1;
                if (paramCount > 5) {
                    patterns.push(this.createLongParameterListPattern(signature, lines));
                }
            });
        }

        return patterns;
    }

    private createGodClassPattern(lines: string[]): CodePattern {
        return {
            id: `god-class-${Date.now()}`,
            name: 'God Class',
            description: 'Class with too many responsibilities',
            confidence: 70,
            category: PatternCategory.ANTI_PATTERN,
            complexity: 'complex',
            codeSnippet: lines.slice(0, 10).join('\n'),
            location: {
                filePath: '',
                startLine: 1,
                endLine: lines.length,
                startColumn: 0,
                endColumn: 0
            },
            suggestedRecipes: ['extract-class', 'single-responsibility'],
            metadata: {
                language: 'java',
                antiPattern: true,
                performanceImpact: 'low',
                securityImpact: 'none',
                maintainabilityImpact: 'high',
                estimatedInstances: 1,
                lastDetected: new Date()
            }
        };
    }

    private createLongParameterListPattern(signature: string, lines: string[]): CodePattern {
        return {
            id: `long-param-list-${Date.now()}`,
            name: 'Long Parameter List',
            description: 'Method with too many parameters',
            confidence: 85,
            category: PatternCategory.ANTI_PATTERN,
            complexity: 'moderate',
            codeSnippet: signature,
            location: {
                filePath: '',
                startLine: 1,
                endLine: 1,
                startColumn: 0,
                endColumn: signature.length
            },
            suggestedRecipes: ['introduce-parameter-object', 'extract-method'],
            metadata: {
                language: 'java',
                antiPattern: true,
                performanceImpact: 'none',
                securityImpact: 'none',
                maintainabilityImpact: 'medium',
                estimatedInstances: 1,
                lastDetected: new Date()
            }
        };
    }

    private async detectFrameworkSpecificPatterns(
        codeContent: string,
        lines: string[],
        request: PatternAnalysisRequest
    ): Promise<CodePattern[]> {
        const patterns: CodePattern[] = [];

        if (request.framework === 'spring' || codeContent.includes('springframework')) {
            patterns.push(...this.detectSpringPatterns(codeContent, lines));
        }

        if (request.framework === 'junit' || codeContent.includes('org.junit')) {
            patterns.push(...this.detectJUnitPatterns(codeContent, lines));
        }

        return patterns;
    }

    private detectSpringPatterns(codeContent: string, lines: string[]): CodePattern[] {
        const patterns: CodePattern[] = [];

        // Detect @Autowired field injection (anti-pattern)
        const fieldInjectionMatches = codeContent.match(/@Autowired\s+private/g);
        if (fieldInjectionMatches && fieldInjectionMatches.length > 0) {
            patterns.push({
                id: `field-injection-${Date.now()}`,
                name: 'Field Injection Anti-pattern',
                description: 'Using @Autowired on fields instead of constructor injection',
                confidence: 90,
                category: PatternCategory.ANTI_PATTERN,
                complexity: 'simple',
                codeSnippet: fieldInjectionMatches[0],
                location: this.findPatternLocation(codeContent, fieldInjectionMatches[0], lines),
                suggestedRecipes: ['constructor-injection'],
                metadata: {
                    language: 'java',
                    framework: 'spring',
                    antiPattern: true,
                    performanceImpact: 'none',
                    securityImpact: 'none',
                    maintainabilityImpact: 'medium',
                    estimatedInstances: fieldInjectionMatches.length,
                    lastDetected: new Date()
                }
            });
        }

        return patterns;
    }

    private detectJUnitPatterns(codeContent: string, lines: string[]): CodePattern[] {
        const patterns: CodePattern[] = [];

        // Detect JUnit 4 patterns that should be migrated to JUnit 5
        if (codeContent.includes('org.junit.Test') && !codeContent.includes('org.junit.jupiter')) {
            patterns.push({
                id: `junit4-migration-${Date.now()}`,
                name: 'JUnit 4 to 5 Migration Opportunity',
                description: 'Code using JUnit 4 that could be migrated to JUnit 5',
                confidence: 95,
                category: PatternCategory.MODERNIZATION,
                complexity: 'moderate',
                codeSnippet: 'import org.junit.Test;',
                location: this.findPatternLocation(codeContent, 'org.junit.Test', lines),
                suggestedRecipes: ['junit4-to-junit5'],
                metadata: {
                    language: 'java',
                    framework: 'junit',
                    antiPattern: false,
                    performanceImpact: 'none',
                    securityImpact: 'none',
                    maintainabilityImpact: 'low',
                    estimatedInstances: 1,
                    lastDetected: new Date()
                }
            });
        }

        return patterns;
    }

    private async semanticPatternDetection(
        codeContent: string,
        request: PatternAnalysisRequest
    ): Promise<CodePattern[]> {
        // Use Moderne CLI for semantic analysis
        try {
            const tempFile = await this.createTempFile(codeContent, request.language);
            const result = await this.cliService.executeCommand([
                'mod',
                'study',
                '--scope', 'patterns',
                '--format', 'json',
                tempFile
            ]);

            const analysis = result.success ? JSON.parse(result.stdout || '{}') : {};
            return this.parseModernePatterns(analysis);

        } catch (error) {
            this.logger.warn(`Semantic pattern detection failed: ${error}`);
            return [];
        }
    }

    private async mlBasedPatternDetection(
        codeContent: string,
        request: PatternAnalysisRequest
    ): Promise<CodePattern[]> {
        // Placeholder for ML-based pattern detection
        // In a real implementation, this would use trained models
        this.logger.info('ML-based pattern detection is not yet implemented');
        return [];
    }

    private adjustPatternsWithLearning(patterns: CodePattern[]): CodePattern[] {
        return patterns.map(pattern => {
            const feedback = this.findRelevantFeedback(pattern);
            if (feedback.length > 0) {
                // Adjust confidence based on user feedback
                const positiveCount = feedback.filter(f => f.userConfirmation === 'correct').length;
                const totalCount = feedback.length;
                const adjustmentFactor = (positiveCount / totalCount) * 0.2; // Max 20% adjustment
                
                pattern.confidence = Math.max(0, Math.min(100, 
                    pattern.confidence + (adjustmentFactor * 100)
                ));
            }
            return pattern;
        });
    }

    private findRelevantFeedback(pattern: CodePattern): LearningFeedback[] {
        return this.learningData.filter(feedback => 
            feedback.patternId === pattern.name || 
            feedback.actualPattern === pattern.name
        );
    }

    private generateSummary(patterns: CodePattern[]): AnalysisSummary {
        const patternsByCategory: Record<PatternCategory, number> = {} as any;
        
        Object.values(PatternCategory).forEach(category => {
            patternsByCategory[category] = patterns.filter(p => p.category === category).length;
        });

        const highConfidencePatterns = patterns.filter(p => p.confidence >= 80).length;
        const criticalIssues = patterns.filter(p => 
            p.metadata.securityImpact === 'high' || 
            p.metadata.performanceImpact === 'high'
        ).length;

        let estimatedRefactoringEffort: 'low' | 'medium' | 'high' = 'low';
        const complexPatterns = patterns.filter(p => p.complexity === 'complex').length;
        const totalPatterns = patterns.length;

        if (complexPatterns > totalPatterns * 0.3 || totalPatterns > 50) {
            estimatedRefactoringEffort = 'high';
        } else if (complexPatterns > totalPatterns * 0.1 || totalPatterns > 20) {
            estimatedRefactoringEffort = 'medium';
        }

        return {
            totalPatterns: patterns.length,
            patternsByCategory,
            highConfidencePatterns,
            criticalIssues,
            estimatedRefactoringEffort
        };
    }

    private generateRecommendations(patterns: CodePattern[]): PatternRecommendation[] {
        const recommendations: PatternRecommendation[] = [];

        // Group patterns by suggested recipes
        const recipeGroups = new Map<string, CodePattern[]>();
        patterns.forEach(pattern => {
            pattern.suggestedRecipes.forEach(recipe => {
                if (!recipeGroups.has(recipe)) {
                    recipeGroups.set(recipe, []);
                }
                recipeGroups.get(recipe)!.push(pattern);
            });
        });

        // Generate recommendations for each recipe group
        recipeGroups.forEach((groupPatterns, recipe) => {
            const highestImpactPattern = groupPatterns.reduce((prev, current) => 
                this.calculateImpactScore(current) > this.calculateImpactScore(prev) ? current : prev
            );

            const recommendation: PatternRecommendation = {
                patternId: highestImpactPattern.id,
                priority: this.calculatePriority(highestImpactPattern),
                title: `Apply ${recipe} recipe`,
                description: `Address ${groupPatterns.length} instances of ${highestImpactPattern.name}`,
                rationale: this.generateRationale(highestImpactPattern),
                suggestedActions: [
                    `Run the ${recipe} recipe on affected files`,
                    'Review the changes before applying',
                    'Test the functionality after application'
                ],
                estimatedEffort: this.estimateEffort(groupPatterns),
                potentialBenefits: this.generateBenefits(groupPatterns)
            };

            recommendations.push(recommendation);
        });

        return recommendations.sort((a, b) => {
            const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    private calculateImpactScore(pattern: CodePattern): number {
        const impacts = {
            none: 0, low: 1, medium: 2, high: 3
        };

        return impacts[pattern.metadata.performanceImpact] +
               impacts[pattern.metadata.securityImpact] +
               impacts[pattern.metadata.maintainabilityImpact];
    }

    private calculatePriority(pattern: CodePattern): 'low' | 'medium' | 'high' | 'critical' {
        if (pattern.metadata.securityImpact === 'high') {return 'critical';}
        if (pattern.metadata.performanceImpact === 'high') {return 'high';}
        if (pattern.confidence >= 90) {return 'high';}
        if (pattern.confidence >= 70) {return 'medium';}
        return 'low';
    }

    private generateRationale(pattern: CodePattern): string {
        const impacts = [];
        if (pattern.metadata.performanceImpact !== 'none') {
            impacts.push(`${pattern.metadata.performanceImpact} performance impact`);
        }
        if (pattern.metadata.securityImpact !== 'none') {
            impacts.push(`${pattern.metadata.securityImpact} security impact`);
        }
        if (pattern.metadata.maintainabilityImpact !== 'none') {
            impacts.push(`${pattern.metadata.maintainabilityImpact} maintainability impact`);
        }

        return `This pattern has ${impacts.join(', ')} and should be addressed to improve code quality.`;
    }

    private estimateEffort(patterns: CodePattern[]): string {
        const totalComplexity = patterns.reduce((sum, p) => {
            const complexity = { simple: 1, moderate: 2, complex: 3 };
            return sum + complexity[p.complexity];
        }, 0);

        if (totalComplexity > patterns.length * 2) {return 'High';}
        if (totalComplexity > patterns.length * 1.5) {return 'Medium';}
        return 'Low';
    }

    private generateBenefits(patterns: CodePattern[]): string[] {
        const benefits = new Set<string>();

        patterns.forEach(pattern => {
            if (pattern.metadata.performanceImpact !== 'none') {
                benefits.add('Improved performance');
            }
            if (pattern.metadata.securityImpact !== 'none') {
                benefits.add('Enhanced security');
            }
            if (pattern.metadata.maintainabilityImpact !== 'none') {
                benefits.add('Better maintainability');
            }
            if (pattern.category === PatternCategory.MODERNIZATION) {
                benefits.add('Code modernization');
            }
        });

        return Array.from(benefits);
    }

    // Utility methods
    private calculateLocation(match: RegExpExecArray, lines: string[]): PatternLocation {
        const beforeMatch = match.input!.substring(0, match.index);
        const linesBefore = beforeMatch.split('\n');
        const startLine = linesBefore.length - 1;
        const startColumn = linesBefore[linesBefore.length - 1].length;
        
        const matchText = match[0];
        const matchLines = matchText.split('\n');
        const endLine = startLine + matchLines.length - 1;
        const endColumn = matchLines.length > 1 ? 
            matchLines[matchLines.length - 1].length : 
            startColumn + matchText.length;

        return {
            filePath: '',
            startLine,
            endLine,
            startColumn,
            endColumn
        };
    }

    private findPatternLocation(content: string, pattern: string, lines: string[]): PatternLocation {
        const index = content.indexOf(pattern);
        if (index === -1) {
            return {
                filePath: '',
                startLine: 0,
                endLine: 0,
                startColumn: 0,
                endColumn: 0
            };
        }

        const beforePattern = content.substring(0, index);
        const linesBefore = beforePattern.split('\n');
        const startLine = linesBefore.length - 1;
        const startColumn = linesBefore[linesBefore.length - 1].length;

        return {
            filePath: '',
            startLine,
            endLine: startLine,
            startColumn,
            endColumn: startColumn + pattern.length
        };
    }

    private extractCodeSnippet(lines: string[], location: PatternLocation): string {
        const startLine = Math.max(0, location.startLine - 1);
        const endLine = Math.min(lines.length - 1, location.endLine + 1);
        return lines.slice(startLine, endLine + 1).join('\n');
    }

    private generateCacheKey(request: PatternAnalysisRequest): string {
        return JSON.stringify({
            filePath: request.filePath,
            contentHash: request.codeContent ? this.hashCode(request.codeContent) : null,
            language: request.language,
            framework: request.framework,
            depth: request.analysisDepth
        });
    }

    private hashCode(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }

    private async createTempFile(content: string, language: string): Promise<string> {
        const extension = language === 'java' ? '.java' : '.txt';
        const tempPath = path.join(process.cwd(), `temp-${Date.now()}${extension}`);
        
        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(tempPath),
            Buffer.from(content, 'utf8')
        );
        
        return tempPath;
    }

    private parseModernePatterns(analysis: any): CodePattern[] {
        // Parse patterns from Moderne CLI output
        const patterns: CodePattern[] = [];
        
        if (analysis.patterns) {
            analysis.patterns.forEach((pattern: any) => {
                patterns.push({
                    id: pattern.id || `moderne-${Date.now()}`,
                    name: pattern.name,
                    description: pattern.description,
                    confidence: pattern.confidence || 80,
                    category: this.mapModerneCategory(pattern.category),
                    complexity: pattern.complexity || 'moderate',
                    codeSnippet: pattern.snippet || '',
                    location: pattern.location || {
                        filePath: '',
                        startLine: 0,
                        endLine: 0,
                        startColumn: 0,
                        endColumn: 0
                    },
                    suggestedRecipes: pattern.suggestedRecipes || [],
                    metadata: {
                        language: 'java',
                        antiPattern: pattern.antiPattern || false,
                        performanceImpact: pattern.performanceImpact || 'none',
                        securityImpact: pattern.securityImpact || 'none',
                        maintainabilityImpact: pattern.maintainabilityImpact || 'none',
                        estimatedInstances: 1,
                        lastDetected: new Date()
                    }
                });
            });
        }
        
        return patterns;
    }

    private mapModerneCategory(category: string): PatternCategory {
        const mapping: Record<string, PatternCategory> = {
            'anti-pattern': PatternCategory.ANTI_PATTERN,
            'performance': PatternCategory.PERFORMANCE,
            'security': PatternCategory.SECURITY,
            'maintainability': PatternCategory.MAINTAINABILITY,
            'modernization': PatternCategory.MODERNIZATION
        };
        
        return mapping[category] || PatternCategory.BEST_PRACTICE;
    }

    // Public API for learning and feedback
    async provideFeedback(feedback: LearningFeedback): Promise<void> {
        this.learningData.push(feedback);
        this._onDidLearnFromFeedback.fire(feedback);
        
        // Store feedback for future learning
        await this.storeFeedback(feedback);
        
        this.logger.info(`Received feedback for pattern: ${feedback.patternId}`);
    }

    private async storeFeedback(feedback: LearningFeedback): Promise<void> {
        try {
            const feedbackFile = path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
                '.vscode', 'moderne', 'pattern-feedback.json'
            );
            
            let existingFeedback: LearningFeedback[] = [];
            try {
                const content = await vscode.workspace.fs.readFile(vscode.Uri.file(feedbackFile));
                existingFeedback = JSON.parse(content.toString());
            } catch {
                // File doesn't exist yet, that's fine
            }
            
            existingFeedback.push(feedback);
            
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(feedbackFile),
                Buffer.from(JSON.stringify(existingFeedback, null, 2), 'utf8')
            );
        } catch (error) {
            this.logger.warn(`Failed to store feedback: ${error}`);
        }
    }

    // Public API
    getDetectedPatterns(filePath: string): CodePattern[] {
        return this.detectedPatterns.get(filePath) || [];
    }

    clearCache(): void {
        this.analysisCache.clear();
        this.detectedPatterns.clear();
    }

    dispose(): void {
        this._onDidDetectPatterns.dispose();
        this._onDidLearnFromFeedback.dispose();
        this.clearCache();
    }
}

// Supporting interfaces
interface PatternDefinition {
    id: string;
    name: string;
    description: string;
    category: PatternCategory;
    patterns: RegExp[];
    confidence: number;
    suggestedRecipes: string[];
    metadata: {
        complexity: 'simple' | 'moderate' | 'complex';
        performanceImpact?: 'none' | 'low' | 'medium' | 'high';
        securityImpact?: 'none' | 'low' | 'medium' | 'high';
        maintainabilityImpact?: 'none' | 'low' | 'medium' | 'high';
        framework?: string;
    };
}