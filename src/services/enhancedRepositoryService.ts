import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import { RepositoryService } from './repositoryService';
import { CliService } from './cliService';
import { ConfigService } from './configService';
import { Logger } from '../utils/logger';

export interface RepositoryProfile {
    id: string;
    name: string;
    path: string;
    type: 'local' | 'remote' | 'workspace';
    metadata: RepositoryMetadata;
    health: RepositoryHealth;
    tags: string[];
    lastScanTime?: Date;
    isActive: boolean;
}

export interface RepositoryMetadata {
    language: string;
    buildTool: 'maven' | 'gradle' | 'npm' | 'other';
    frameworkVersions: Record<string, string>;
    dependencies: DependencyInfo[];
    testCoverage?: number;
    codeQuality?: CodeQualityMetrics;
    modernizationOpportunities: ModernizationOpportunity[];
}

export interface DependencyInfo {
    name: string;
    version: string;
    type: 'compile' | 'test' | 'runtime';
    scope: string;
    isOutdated: boolean;
    latestVersion?: string;
    vulnerabilities: SecurityVulnerability[];
}

export interface SecurityVulnerability {
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    fixedIn?: string;
}

export interface CodeQualityMetrics {
    complexity: number;
    duplication: number;
    maintainabilityIndex: number;
    technicalDebt: string;
    issues: QualityIssue[];
}

export interface QualityIssue {
    type: 'bug' | 'vulnerability' | 'code_smell';
    severity: 'info' | 'minor' | 'major' | 'critical';
    message: string;
    file: string;
    line: number;
}

export interface ModernizationOpportunity {
    id: string;
    type: 'dependency_upgrade' | 'framework_migration' | 'api_modernization' | 'performance';
    priority: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    estimatedEffort: 'small' | 'medium' | 'large';
    potentialBenefits: string[];
    requiredRecipes: string[];
    prerequisites?: string[];
}

export interface RepositoryHealth {
    overall: 'excellent' | 'good' | 'fair' | 'poor';
    scores: {
        security: number;
        maintainability: number;
        performance: number;
        modernity: number;
    };
    issues: HealthIssue[];
    recommendations: string[];
}

export interface HealthIssue {
    category: 'security' | 'maintainability' | 'performance' | 'compatibility';
    severity: 'low' | 'medium' | 'high';
    description: string;
    impact: string;
    resolution: string;
}

export interface RepositoryGroup {
    id: string;
    name: string;
    description: string;
    repositories: string[];
    tags: string[];
    configuration: GroupConfiguration;
}

export interface GroupConfiguration {
    defaultRecipes: string[];
    excludePatterns: string[];
    analysisSettings: Record<string, any>;
    notifications: boolean;
}

export interface RepositoryComparison {
    repositories: RepositoryProfile[];
    metrics: ComparisonMetric[];
    summary: ComparisonSummary;
}

export interface ComparisonMetric {
    name: string;
    type: 'numeric' | 'categorical' | 'boolean';
    values: Record<string, any>;
    trend?: 'improving' | 'declining' | 'stable';
}

export interface ComparisonSummary {
    bestPerforming: string[];
    needsAttention: string[];
    recommendations: string[];
}

export class EnhancedRepositoryService extends RepositoryService {
    private profiles = new Map<string, RepositoryProfile>();
    private groups = new Map<string, RepositoryGroup>();
    private scanningStatus = new Map<string, boolean>();
    
    private readonly _onDidUpdateProfile = new vscode.EventEmitter<RepositoryProfile>();
    private readonly _onDidCreateGroup = new vscode.EventEmitter<RepositoryGroup>();
    private readonly _onDidUpdateGroup = new vscode.EventEmitter<RepositoryGroup>();

    readonly onDidUpdateProfile = this._onDidUpdateProfile.event;
    readonly onDidCreateGroup = this._onDidCreateGroup.event;
    readonly onDidUpdateGroup = this._onDidUpdateGroup.event;

    constructor(
        cliService: CliService,
        configService: ConfigService,
        logger: Logger
    ) {
        super(cliService, logger);
        this.loadStoredProfiles();
        this.loadStoredGroups();
    }

    private async loadStoredProfiles(): Promise<void> {
        try {
            const storageUri = this.getStorageUri();
            const profilesFile = path.join(storageUri.fsPath, 'repository-profiles.json');
            
            if (await fs.pathExists(profilesFile)) {
                const data = await fs.readJson(profilesFile);
                data.forEach((profile: any) => {
                    this.profiles.set(profile.id, {
                        ...profile,
                        lastScanTime: profile.lastScanTime ? new Date(profile.lastScanTime) : undefined
                    });
                });
            }
        } catch (error) {
            this.logger.error(`Failed to load repository profiles: ${error}`);
        }
    }

    private async loadStoredGroups(): Promise<void> {
        try {
            const storageUri = this.getStorageUri();
            const groupsFile = path.join(storageUri.fsPath, 'repository-groups.json');
            
            if (await fs.pathExists(groupsFile)) {
                const data = await fs.readJson(groupsFile);
                data.forEach((group: RepositoryGroup) => {
                    this.groups.set(group.id, group);
                });
            }
        } catch (error) {
            this.logger.error(`Failed to load repository groups: ${error}`);
        }
    }

    private async saveProfiles(): Promise<void> {
        try {
            const storageUri = this.getStorageUri();
            await fs.ensureDir(storageUri.fsPath);
            
            const profilesFile = path.join(storageUri.fsPath, 'repository-profiles.json');
            const profiles = Array.from(this.profiles.values());
            await fs.writeJson(profilesFile, profiles, { spaces: 2 });
        } catch (error) {
            this.logger.error(`Failed to save repository profiles: ${error}`);
        }
    }

    private async saveGroups(): Promise<void> {
        try {
            const storageUri = this.getStorageUri();
            await fs.ensureDir(storageUri.fsPath);
            
            const groupsFile = path.join(storageUri.fsPath, 'repository-groups.json');
            const groups = Array.from(this.groups.values());
            await fs.writeJson(groupsFile, groups, { spaces: 2 });
        } catch (error) {
            this.logger.error(`Failed to save repository groups: ${error}`);
        }
    }

    private getStorageUri(): vscode.Uri {
        return vscode.Uri.file(path.join(process.cwd(), '.vscode', 'moderne'));
    }

    async scanRepository(repositoryPath: string, force = false): Promise<RepositoryProfile> {
        const repoId = this.generateRepositoryId(repositoryPath);
        const existingProfile = this.profiles.get(repoId);

        // Check if scan is needed
        if (!force && existingProfile && existingProfile.lastScanTime) {
            const timeSinceLastScan = Date.now() - existingProfile.lastScanTime.getTime();
            const scanInterval = 24 * 60 * 60 * 1000; // 24 hours
            
            if (timeSinceLastScan < scanInterval) {
                return existingProfile;
            }
        }

        // Prevent concurrent scanning
        if (this.scanningStatus.get(repoId)) {
            throw new Error(`Repository ${repositoryPath} is already being scanned`);
        }

        this.scanningStatus.set(repoId, true);

        try {
            this.logger.info(`Scanning repository: ${repositoryPath}`);

            const profile: RepositoryProfile = {
                id: repoId,
                name: path.basename(repositoryPath),
                path: repositoryPath,
                type: this.determineRepositoryType(repositoryPath),
                metadata: await this.analyzeRepositoryMetadata(repositoryPath),
                health: await this.assessRepositoryHealth(repositoryPath),
                tags: await this.generateTags(repositoryPath),
                lastScanTime: new Date(),
                isActive: true
            };

            this.profiles.set(repoId, profile);
            await this.saveProfiles();

            this._onDidUpdateProfile.fire(profile);
            this.logger.info(`Repository scan completed: ${repositoryPath}`);

            return profile;

        } finally {
            this.scanningStatus.set(repoId, false);
        }
    }

    private determineRepositoryType(repositoryPath: string): RepositoryProfile['type'] {
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        const isInWorkspace = workspaceFolders.some(folder => 
            repositoryPath.startsWith(folder.uri.fsPath)
        );

        if (isInWorkspace) {
            return 'workspace';
        }

        // Check if it's a remote repository reference
        if (repositoryPath.startsWith('http') || repositoryPath.includes('@')) {
            return 'remote';
        }

        return 'local';
    }

    private async analyzeRepositoryMetadata(repositoryPath: string): Promise<RepositoryMetadata> {
        const metadata: RepositoryMetadata = {
            language: await this.detectLanguage(repositoryPath),
            buildTool: await this.detectBuildTool(repositoryPath),
            frameworkVersions: await this.detectFrameworkVersions(repositoryPath),
            dependencies: await this.analyzeDependencies(repositoryPath),
            modernizationOpportunities: []
        };

        // Analyze modernization opportunities
        metadata.modernizationOpportunities = await this.identifyModernizationOpportunities(metadata);

        return metadata;
    }

    private async detectLanguage(repositoryPath: string): Promise<string> {
        const files = await fs.readdir(repositoryPath);
        
        // Check for Java
        if (files.some(f => f.endsWith('.java') || f === 'pom.xml' || f === 'build.gradle')) {
            return 'java';
        }
        
        // Check for JavaScript/TypeScript
        if (files.some(f => f === 'package.json' || f.endsWith('.js') || f.endsWith('.ts'))) {
            return 'javascript';
        }
        
        // Check for Python
        if (files.some(f => f.endsWith('.py') || f === 'requirements.txt' || f === 'setup.py')) {
            return 'python';
        }

        return 'unknown';
    }

    private async detectBuildTool(repositoryPath: string): Promise<RepositoryMetadata['buildTool']> {
        const files = await fs.readdir(repositoryPath);
        
        if (files.includes('pom.xml')) return 'maven';
        if (files.includes('build.gradle') || files.includes('build.gradle.kts')) return 'gradle';
        if (files.includes('package.json')) return 'npm';
        
        return 'other';
    }

    private async detectFrameworkVersions(repositoryPath: string): Promise<Record<string, string>> {
        const versions: Record<string, string> = {};

        try {
            // For Java projects, check Spring Boot version
            const pomPath = path.join(repositoryPath, 'pom.xml');
            if (await fs.pathExists(pomPath)) {
                const pomContent = await fs.readFile(pomPath, 'utf8');
                const springBootMatch = pomContent.match(/<spring-boot\.version>([^<]+)<\/spring-boot\.version>/);
                if (springBootMatch) {
                    versions['spring-boot'] = springBootMatch[1];
                }
            }

            // For Node.js projects, check package.json
            const packagePath = path.join(repositoryPath, 'package.json');
            if (await fs.pathExists(packagePath)) {
                const packageJson = await fs.readJson(packagePath);
                if (packageJson.dependencies) {
                    Object.keys(packageJson.dependencies).forEach(dep => {
                        if (dep.includes('react') || dep.includes('vue') || dep.includes('angular')) {
                            versions[dep] = packageJson.dependencies[dep];
                        }
                    });
                }
            }
        } catch (error) {
            this.logger.warn(`Failed to detect framework versions: ${error}`);
        }

        return versions;
    }

    private async analyzeDependencies(repositoryPath: string): Promise<DependencyInfo[]> {
        const dependencies: DependencyInfo[] = [];

        try {
            // Use Moderne CLI to analyze dependencies
            const output = await this.cliService.executeCommand('mod', [
                'study',
                '--scope', 'dependencies',
                '--format', 'json',
                repositoryPath
            ]);

            const analysis = JSON.parse(output);
            
            if (analysis.dependencies) {
                dependencies.push(...analysis.dependencies.map((dep: any) => ({
                    name: dep.name,
                    version: dep.version,
                    type: dep.type || 'compile',
                    scope: dep.scope || 'compile',
                    isOutdated: dep.isOutdated || false,
                    latestVersion: dep.latestVersion,
                    vulnerabilities: dep.vulnerabilities || []
                })));
            }
        } catch (error) {
            this.logger.warn(`Failed to analyze dependencies: ${error}`);
        }

        return dependencies;
    }

    private async identifyModernizationOpportunities(
        metadata: RepositoryMetadata
    ): Promise<ModernizationOpportunity[]> {
        const opportunities: ModernizationOpportunity[] = [];

        // Check for outdated dependencies
        const outdatedDeps = metadata.dependencies.filter(dep => dep.isOutdated);
        if (outdatedDeps.length > 0) {
            opportunities.push({
                id: 'dependency-updates',
                type: 'dependency_upgrade',
                priority: 'medium',
                title: 'Update Outdated Dependencies',
                description: `${outdatedDeps.length} dependencies have newer versions available`,
                estimatedEffort: outdatedDeps.length > 10 ? 'large' : 'medium',
                potentialBenefits: [
                    'Security improvements',
                    'Performance enhancements',
                    'New features and bug fixes'
                ],
                requiredRecipes: ['org.openrewrite.java.dependencies.UpgradeDependencyVersion']
            });
        }

        // Check for security vulnerabilities
        const vulnerableDeps = metadata.dependencies.filter(dep => dep.vulnerabilities.length > 0);
        if (vulnerableDeps.length > 0) {
            opportunities.push({
                id: 'security-fixes',
                type: 'dependency_upgrade',
                priority: 'high',
                title: 'Fix Security Vulnerabilities',
                description: `${vulnerableDeps.length} dependencies have known security vulnerabilities`,
                estimatedEffort: 'medium',
                potentialBenefits: [
                    'Improved security posture',
                    'Compliance with security policies'
                ],
                requiredRecipes: ['org.openrewrite.java.security.SecureRandom']
            });
        }

        // Framework-specific opportunities
        if (metadata.frameworkVersions['spring-boot']) {
            const version = metadata.frameworkVersions['spring-boot'];
            if (this.isVersionOutdated(version, '2.7.0')) {
                opportunities.push({
                    id: 'spring-boot-upgrade',
                    type: 'framework_migration',
                    priority: 'medium',
                    title: 'Upgrade Spring Boot',
                    description: `Current version ${version} can be upgraded to latest`,
                    estimatedEffort: 'large',
                    potentialBenefits: [
                        'Java 17+ support',
                        'Performance improvements',
                        'Security updates'
                    ],
                    requiredRecipes: ['org.openrewrite.java.spring.boot2.UpgradeSpringBoot_2_7']
                });
            }
        }

        return opportunities;
    }

    private isVersionOutdated(current: string, minimum: string): boolean {
        // Simple version comparison - would need proper semver comparison in real implementation
        return current.localeCompare(minimum, undefined, { numeric: true }) < 0;
    }

    private async assessRepositoryHealth(repositoryPath: string): Promise<RepositoryHealth> {
        const health: RepositoryHealth = {
            overall: 'fair',
            scores: {
                security: 75,
                maintainability: 70,
                performance: 80,
                modernity: 60
            },
            issues: [],
            recommendations: []
        };

        try {
            // Use Moderne CLI for health assessment
            const output = await this.cliService.executeCommand('mod', [
                'study',
                '--scope', 'health',
                '--format', 'json',
                repositoryPath
            ]);

            const analysis = JSON.parse(output);
            
            if (analysis.health) {
                health.scores = { ...health.scores, ...analysis.health.scores };
                health.issues = analysis.health.issues || [];
                health.recommendations = analysis.health.recommendations || [];
            }
        } catch (error) {
            this.logger.warn(`Failed to assess repository health: ${error}`);
        }

        // Calculate overall health
        const avgScore = Object.values(health.scores).reduce((sum, score) => sum + score, 0) / 4;
        if (avgScore >= 90) health.overall = 'excellent';
        else if (avgScore >= 75) health.overall = 'good';
        else if (avgScore >= 60) health.overall = 'fair';
        else health.overall = 'poor';

        return health;
    }

    private async generateTags(repositoryPath: string): Promise<string[]> {
        const tags: string[] = [];

        try {
            const files = await fs.readdir(repositoryPath);
            
            // Add build tool tags
            if (files.includes('pom.xml')) tags.push('maven');
            if (files.includes('build.gradle')) tags.push('gradle');
            if (files.includes('package.json')) tags.push('npm');
            
            // Add framework tags
            if (files.some(f => f.includes('spring'))) tags.push('spring');
            if (files.includes('angular.json')) tags.push('angular');
            
            // Add language tags
            if (files.some(f => f.endsWith('.java'))) tags.push('java');
            if (files.some(f => f.endsWith('.ts'))) tags.push('typescript');
            if (files.some(f => f.endsWith('.js'))) tags.push('javascript');
            
        } catch (error) {
            this.logger.warn(`Failed to generate tags: ${error}`);
        }

        return tags;
    }

    private generateRepositoryId(repositoryPath: string): string {
        return `repo-${Buffer.from(repositoryPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '')}`;
    }

    // Repository Groups Management
    async createGroup(
        name: string,
        description: string,
        repositories: string[],
        configuration: Partial<GroupConfiguration> = {}
    ): Promise<RepositoryGroup> {
        const group: RepositoryGroup = {
            id: `group-${Date.now()}`,
            name,
            description,
            repositories,
            tags: [],
            configuration: {
                defaultRecipes: [],
                excludePatterns: [],
                analysisSettings: {},
                notifications: true,
                ...configuration
            }
        };

        this.groups.set(group.id, group);
        await this.saveGroups();

        this._onDidCreateGroup.fire(group);
        return group;
    }

    async updateGroup(groupId: string, updates: Partial<RepositoryGroup>): Promise<RepositoryGroup> {
        const group = this.groups.get(groupId);
        if (!group) {
            throw new Error(`Group not found: ${groupId}`);
        }

        const updatedGroup = { ...group, ...updates };
        this.groups.set(groupId, updatedGroup);
        await this.saveGroups();

        this._onDidUpdateGroup.fire(updatedGroup);
        return updatedGroup;
    }

    // Comparison and Analysis
    async compareRepositories(repositoryIds: string[]): Promise<RepositoryComparison> {
        const repositories = repositoryIds
            .map(id => this.profiles.get(id))
            .filter((profile): profile is RepositoryProfile => profile !== undefined);

        if (repositories.length < 2) {
            throw new Error('At least 2 repositories are required for comparison');
        }

        const metrics: ComparisonMetric[] = [
            {
                name: 'Security Score',
                type: 'numeric',
                values: Object.fromEntries(repositories.map(repo => [repo.name, repo.health.scores.security]))
            },
            {
                name: 'Maintainability',
                type: 'numeric',
                values: Object.fromEntries(repositories.map(repo => [repo.name, repo.health.scores.maintainability]))
            },
            {
                name: 'Modernity Score',
                type: 'numeric',
                values: Object.fromEntries(repositories.map(repo => [repo.name, repo.health.scores.modernity]))
            },
            {
                name: 'Build Tool',
                type: 'categorical',
                values: Object.fromEntries(repositories.map(repo => [repo.name, repo.metadata.buildTool]))
            }
        ];

        const summary: ComparisonSummary = {
            bestPerforming: this.identifyBestPerforming(repositories),
            needsAttention: this.identifyNeedsAttention(repositories),
            recommendations: this.generateComparisonRecommendations(repositories)
        };

        return { repositories, metrics, summary };
    }

    private identifyBestPerforming(repositories: RepositoryProfile[]): string[] {
        return repositories
            .filter(repo => repo.health.overall === 'excellent' || repo.health.overall === 'good')
            .map(repo => repo.name);
    }

    private identifyNeedsAttention(repositories: RepositoryProfile[]): string[] {
        return repositories
            .filter(repo => repo.health.overall === 'poor' || repo.health.issues.length > 5)
            .map(repo => repo.name);
    }

    private generateComparisonRecommendations(repositories: RepositoryProfile[]): string[] {
        const recommendations: string[] = [];

        const avgSecurity = repositories.reduce((sum, repo) => sum + repo.health.scores.security, 0) / repositories.length;
        if (avgSecurity < 70) {
            recommendations.push('Focus on security improvements across all repositories');
        }

        const outdatedCount = repositories.filter(repo => 
            repo.metadata.modernizationOpportunities.some(opp => opp.type === 'dependency_upgrade')
        ).length;

        if (outdatedCount > repositories.length / 2) {
            recommendations.push('Consider bulk dependency updates across the repository group');
        }

        return recommendations;
    }

    // Public API
    getProfile(repositoryId: string): RepositoryProfile | undefined {
        return this.profiles.get(repositoryId);
    }

    getAllProfiles(): RepositoryProfile[] {
        return Array.from(this.profiles.values());
    }

    getProfilesByTag(tag: string): RepositoryProfile[] {
        return Array.from(this.profiles.values())
            .filter(profile => profile.tags.includes(tag));
    }

    getGroup(groupId: string): RepositoryGroup | undefined {
        return this.groups.get(groupId);
    }

    getAllGroups(): RepositoryGroup[] {
        return Array.from(this.groups.values());
    }

    async refreshProfile(repositoryId: string): Promise<RepositoryProfile> {
        const profile = this.profiles.get(repositoryId);
        if (!profile) {
            throw new Error(`Profile not found: ${repositoryId}`);
        }

        return this.scanRepository(profile.path, true);
    }

    dispose(): void {
        super.dispose();
        this._onDidUpdateProfile.dispose();
        this._onDidCreateGroup.dispose();
        this._onDidUpdateGroup.dispose();
    }
}