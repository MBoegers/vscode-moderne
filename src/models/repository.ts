export interface Repository {
    id: string;
    name: string;
    path: string;
    organization?: string;
    hasLst: boolean;
    buildStatus: BuildStatus;
    lastBuildTime?: Date;
    branches?: string[];
    remoteUrl?: string;
}

export enum BuildStatus {
    Unknown = 'unknown',
    NotBuilt = 'not-built',
    Building = 'building',
    Success = 'success',
    Failed = 'failed',
    Error = 'error'
}

export interface Organization {
    id: string;
    name: string;
    repositories: Repository[];
}

export interface MultiRepo {
    name: string;
    path: string;
    type: 'local' | 'organization';
    repositories: Repository[];
}

export interface RepositoryStatus {
    repository: Repository;
    lstExists: boolean;
    lstSize?: number;
    lastModified?: Date;
    buildLogs?: string[];
}