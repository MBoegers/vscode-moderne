import * as vscode from 'vscode';
import { Command } from './baseCommand';

export class CheckCliStatusCommand extends Command {
    register(context: vscode.ExtensionContext): void {
        const disposable = vscode.commands.registerCommand(
            'moderne.checkCliStatus',
            this.execute.bind(this)
        );
        context.subscriptions.push(disposable);
    }

    async execute(): Promise<void> {
        try {
            // Check CLI availability
            const isAvailable = await this.services.cli.isAvailable();
            
            if (!isAvailable) {
                const config = this.services.config.getConfiguration();
                vscode.window.showErrorMessage(
                    'Moderne CLI not found. Please check your configuration.',
                    'Open Settings'
                ).then(selection => {
                    if (selection === 'Open Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'moderne.cli');
                    }
                });
                return;
            }

            // Get version and license info
            const [version, licenseInfo] = await Promise.all([
                this.services.cli.checkVersion(),
                this.services.cli.getLicenseInfo()
            ]);

            // Show status information
            const panel = vscode.window.createWebviewPanel(
                'cliStatus',
                'Moderne CLI Status',
                vscode.ViewColumn.Two,
                { enableScripts: false }
            );

            panel.webview.html = this.generateStatusHtml(version, licenseInfo);

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Check CLI Status command failed', error);
            vscode.window.showErrorMessage(`CLI Status Error: ${message}`);
        }
    }

    private generateStatusHtml(version: string, licenseInfo: any): string {
        const cliPath = this.services.cli.getCliExecutablePath();
        
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Moderne CLI Status</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .status-section {
            margin-bottom: 20px;
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
        }
        .status-header {
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 1.1em;
        }
        .status-item {
            margin: 5px 0;
            display: flex;
            justify-content: space-between;
        }
        .status-label {
            font-weight: bold;
        }
        .status-value {
            font-family: monospace;
        }
        .status-success {
            color: var(--vscode-testing-iconPassed);
        }
        .status-error {
            color: var(--vscode-testing-iconFailed);
        }
        .status-warning {
            color: var(--vscode-testing-iconQueued);
        }
    </style>
</head>
<body>
    <h1>Moderne CLI Status</h1>
    
    <div class="status-section">
        <div class="status-header">CLI Information</div>
        <div class="status-item">
            <span class="status-label">Path:</span>
            <span class="status-value">${cliPath}</span>
        </div>
        <div class="status-item">
            <span class="status-label">Version:</span>
            <span class="status-value status-success">${version}</span>
        </div>
        <div class="status-item">
            <span class="status-label">Status:</span>
            <span class="status-value status-success">Available</span>
        </div>
    </div>

    <div class="status-section">
        <div class="status-header">License Information</div>
        ${licenseInfo ? `
        <div class="status-item">
            <span class="status-label">Valid:</span>
            <span class="status-value ${licenseInfo.valid ? 'status-success' : 'status-error'}">
                ${licenseInfo.valid ? 'Yes' : 'No'}
            </span>
        </div>
        ${licenseInfo.type ? `
        <div class="status-item">
            <span class="status-label">Type:</span>
            <span class="status-value">${licenseInfo.type}</span>
        </div>
        ` : ''}
        ${licenseInfo.organization ? `
        <div class="status-item">
            <span class="status-label">Organization:</span>
            <span class="status-value">${licenseInfo.organization}</span>
        </div>
        ` : ''}
        ${licenseInfo.expiresAt ? `
        <div class="status-item">
            <span class="status-label">Expires:</span>
            <span class="status-value">${licenseInfo.expiresAt}</span>
        </div>
        ` : ''}
        ` : `
        <div class="status-item">
            <span class="status-label">Status:</span>
            <span class="status-value status-warning">License information not available</span>
        </div>
        `}
    </div>

    <div class="status-section">
        <div class="status-header">Configuration</div>
        <div class="status-item">
            <span class="status-label">Extension:</span>
            <span class="status-value status-success">Active</span>
        </div>
        <div class="status-item">
            <span class="status-label">Repositories:</span>
            <span class="status-value">${this.services.repository.getBuildStatistics().total}</span>
        </div>
        <div class="status-item">
            <span class="status-label">Active Recipe:</span>
            <span class="status-value">${
                this.services.recipe.getActiveRecipe()?.displayName || 'None'
            }</span>
        </div>
    </div>
</body>
</html>`;
    }
}