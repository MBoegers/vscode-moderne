import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('moderne.vscode-moderne'));
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('moderne.vscode-moderne');
        assert.ok(extension);
        
        await extension!.activate();
        assert.strictEqual(extension!.isActive, true);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        
        const moderneCommands = [
            'moderne.setActiveRecipe',
            'moderne.findUsagesAllRepos',
            'moderne.createRecipe',
            'moderne.refreshRepositories',
            'moderne.checkCliStatus'
        ];

        moderneCommands.forEach(command => {
            assert.ok(
                commands.includes(command),
                `Command ${command} should be registered`
            );
        });
    });
});