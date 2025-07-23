export interface CliResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    exitCode?: number;
    stdout?: string;
    stderr?: string;
}

export class CliError extends Error {
    constructor(
        message: string,
        public exitCode?: number,
        public stderr?: string,
        public stdout?: string
    ) {
        super(message);
        this.name = 'CliError';
    }
}

export interface CliVersion {
    version: string;
    buildDate: string;
    gitSha: string;
}

export interface LicenseInfo {
    valid: boolean;
    type?: string;
    expiresAt?: string;
    organization?: string;
    limits?: {
        repositories?: number;
        users?: number;
    };
}

export interface CliCommand {
    command: string;
    args: string[];
    cwd?: string;
    timeout?: number;
}