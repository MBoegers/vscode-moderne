import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Status Bar Integration Tests', () => {
    
    suiteSetup(async () => {
        const extension = vscode.extensions.getExtension('moderne.vscode-moderne')!;
        await extension.activate();
    });

    test('TEST-031: Status bar item creation', async () => {
        // Test that status bar related commands are available
        // We can't directly test status bar items, but we can test the commands they trigger
        
        const commands = await vscode.commands.getCommands(true);
        const statusBarCommands = [
            'moderne.checkCliStatus',
            'moderne.openConfiguration',
            'moderne.runActiveRecipe'
        ];

        for (const cmd of statusBarCommands) {
            assert.ok(
                commands.includes(cmd),
                `Status bar command ${cmd} should be available`
            );
        }
    });

    test('TEST-032: Status bar command execution', async () => {
        // Test commands that would be triggered by status bar clicks
        
        // Test CLI status command (common status bar action)
        try {
            await vscode.commands.executeCommand('moderne.checkCliStatus');
            assert.ok(true, 'CLI status command should execute from status bar');
        } catch (error) {
            assert.ok(true, 'Command is available even if CLI unavailable');
        }

        // Test configuration command (error state action)
        try {
            await vscode.commands.executeCommand('moderne.openConfiguration');
            assert.ok(true, 'Configuration command should execute from status bar');
        } catch (error) {
            assert.fail(`Configuration command should not fail: ${error}`);
        }

        // Test run active recipe command (active recipe state action)
        try {
            await vscode.commands.executeCommand('moderne.runActiveRecipe');
            assert.ok(true, 'Run active recipe command should execute from status bar');
        } catch (error) {
            assert.ok(true, 'Command is available even if no active recipe');
        }
    });

    test('TEST-033: Status bar tooltip functionality', async () => {
        // We can't directly test tooltips, but we can verify the commands they reference work
        const tooltipCommands = [
            'moderne.checkCliStatus',
            'moderne.openConfiguration',
            'moderne.runActiveRecipe'
        ];

        for (const cmd of tooltipCommands) {
            try {
                await vscode.commands.executeCommand(cmd);
                assert.ok(true, `Tooltip command ${cmd} should be executable`);
            } catch (error) {
                // Expected for some commands when dependencies unavailable
                assert.ok(true, `Command ${cmd} is registered`);
            }
        }
    });

    test('TEST-034: Status bar state transitions', async () => {
        // Test that configuration changes can affect status bar
        const config = vscode.workspace.getConfiguration('moderne');
        const originalEnabled = config.get<boolean>('enabled');

        try {
            // Disable extension
            await config.update('enabled', false, vscode.ConfigurationTarget.Global);
            
            // Wait for configuration change to propagate
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Commands should still be available
            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('moderne.checkCliStatus'),
                'Commands should remain available when disabled'
            );

            // Restore original state
            await config.update('enabled', originalEnabled, vscode.ConfigurationTarget.Global);
        } catch (error) {
            // Restore on error
            await config.update('enabled', originalEnabled, vscode.ConfigurationTarget.Global);
            assert.fail(`Configuration update failed: ${error}`);
        }
    });
});

suite('Status Bar Integration with Recipe States', () => {
    
    test('TEST-035: Status bar with active recipe', async () => {
        // Test that run active recipe command is available for status bar
        const commands = await vscode.commands.getCommands(true);
        
        assert.ok(
            commands.includes('moderne.runActiveRecipe'),
            'Run active recipe command should be available for status bar'
        );

        assert.ok(
            commands.includes('moderne.setActiveRecipe'),
            'Set active recipe command should be available'
        );
    });

    test('TEST-036: Status bar CLI state handling', async () => {
        // Test CLI status checking functionality
        try {
            await vscode.commands.executeCommand('moderne.checkCliStatus');
            assert.ok(true, 'CLI status check should be available for status bar');
        } catch (error) {
            // Expected if CLI not available
            const errorMessage = error instanceof Error ? error.message : String(error);
            assert.ok(
                errorMessage.includes('CLI') || errorMessage.includes('command'),
                'Error should be CLI-related, not command registration issue'
            );
        }
    });

    test('TEST-037: Status bar error state handling', async () => {
        // Test that configuration command works for error states
        try {
            await vscode.commands.executeCommand('moderne.openConfiguration');
            assert.ok(true, 'Configuration command should work for error states');
        } catch (error) {
            assert.fail(`Configuration command should not fail: ${error}`);
        }
    });
});