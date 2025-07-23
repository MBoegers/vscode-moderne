export interface Recipe {
    id: string;
    name: string;
    displayName: string;
    description: string;
    type: RecipeType;
    className: string;
    filePath: string;
    packageName?: string;
    requiredOptions: RecipeOption[];
    isActive: boolean;
}

export enum RecipeType {
    Refaster = 'refaster',
    Visitor = 'visitor',
    Yaml = 'yaml',
    Unknown = 'unknown'
}

export interface RecipeOption {
    name: string;
    type: string;
    description?: string;
    required: boolean;
    defaultValue?: any;
}

export interface ActiveRecipe {
    recipe: string;
    classpath: string;
    requiredOptions?: string;
    javaHome?: string;
    timestamp: Date;
}

export interface RecipeRunResult {
    success: boolean;
    changes: RecipeChange[];
    error?: string;
    duration: number;
    repositoriesProcessed: number;
}

export interface RecipeChange {
    filePath: string;
    before: string;
    after: string;
    repository: string;
}

export interface CodeContext {
    selectedText: string;
    filePath: string;
    language: string;
    lineNumber: number;
    columnNumber: number;
    className?: string;
    methodName?: string;
    packageName?: string;
}