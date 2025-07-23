import * as vscode from 'vscode';
import { Command } from './baseCommand';

export class SearchResultsCommand extends Command {
    register(context: vscode.ExtensionContext): void {
        // Clear search results command
        const clearDisposable = vscode.commands.registerCommand(
            'moderne.clearSearchResults',
            this.clearSearchResults.bind(this)
        );
        context.subscriptions.push(clearDisposable);

        // Toggle search grouping command
        const toggleDisposable = vscode.commands.registerCommand(
            'moderne.toggleSearchGrouping',
            this.toggleSearchGrouping.bind(this)
        );
        context.subscriptions.push(toggleDisposable);

        // Export search results command
        const exportDisposable = vscode.commands.registerCommand(
            'moderne.exportSearchResults',
            this.exportSearchResults.bind(this)
        );
        context.subscriptions.push(exportDisposable);
    }

    async execute(): Promise<void> {
        // This command doesn't have a direct execute - it registers sub-commands
    }

    private async clearSearchResults(): Promise<void> {
        try {
            // Get the search result provider from the registered tree data providers
            const searchResultProvider = this.getSearchResultProvider();
            if (searchResultProvider) {
                searchResultProvider.clearResults();
                vscode.window.showInformationMessage('Search results cleared');
                this.services.logger.info('Search results cleared by user');
            } else {
                vscode.window.showWarningMessage('No search results provider found');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Clear search results failed', error);
            vscode.window.showErrorMessage(`Failed to clear search results: ${message}`);
        }
    }

    private async toggleSearchGrouping(): Promise<void> {
        try {
            const searchResultProvider = this.getSearchResultProvider();
            if (searchResultProvider) {
                searchResultProvider.toggleGrouping();
                vscode.window.showInformationMessage('Search result grouping toggled');
                this.services.logger.info('Search result grouping toggled by user');
            } else {
                vscode.window.showWarningMessage('No search results provider found');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Toggle search grouping failed', error);
            vscode.window.showErrorMessage(`Failed to toggle search grouping: ${message}`);
        }
    }

    private async exportSearchResults(): Promise<void> {
        try {
            const searchResultProvider = this.getSearchResultProvider();
            if (!searchResultProvider) {
                vscode.window.showWarningMessage('No search results provider found');
                return;
            }

            // Show format selection
            const format = await vscode.window.showQuickPick([
                {
                    label: '📄 JSON',
                    description: 'Export as JSON with full metadata',
                    value: 'json'
                },
                {
                    label: '📊 CSV',
                    description: 'Export as CSV for spreadsheet analysis',
                    value: 'csv'
                },
                {
                    label: '📝 Markdown',
                    description: 'Export as Markdown for documentation',
                    value: 'markdown'
                }
            ], {
                placeHolder: 'Select export format'
            });

            if (format) {
                await searchResultProvider.exportResults(format.value as 'json' | 'csv' | 'markdown');
                this.services.logger.info(`Search results exported as ${format.value}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.services.logger.error('Export search results failed', error);
            vscode.window.showErrorMessage(`Failed to export search results: ${message}`);
        }
    }

    private getSearchResultProvider(): any {
        // Access the search result provider from the extension context
        // This is a bit of a hack since VSCode doesn't expose registered providers
        // In a real implementation, we'd store a reference to the provider
        
        // For now, we'll use the search service to access the provider
        const searchService = this.services.search;
        if (searchService && (searchService as any).searchResultProvider) {
            return (searchService as any).searchResultProvider;
        }

        // Alternative: Try to get it from the global extension context
        // This would require storing it as a global reference
        return (global as any).moderneSearchResultProvider;
    }
}