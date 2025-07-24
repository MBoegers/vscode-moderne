/**
 * Unit tests for model classes and interfaces
 * These don't require VSCode environment
 */

import * as assert from 'assert';
import { RecipeType, Recipe } from '../../../models/recipe';
import { BuildStatus } from '../../../models/repository';
import { CliResult } from '../../../models/cliResult';

suite('Models Unit Tests', function() {

    suite('Recipe Model Tests', function() {
        test('RecipeType enum should have correct values', () => {
            assert.strictEqual(RecipeType.Refaster, 'refaster');
            assert.strictEqual(RecipeType.Visitor, 'visitor'); 
            assert.strictEqual(RecipeType.Yaml, 'yaml');
            assert.strictEqual(RecipeType.Unknown, 'unknown');
        });

        test('Recipe interface should be properly structured', () => {
            const recipe: Recipe = {
                id: 'test-recipe-id',
                name: 'TestRecipe',
                displayName: 'Test Recipe Display',
                description: 'A test recipe for unit testing',
                type: RecipeType.Refaster,
                filePath: '/path/to/recipe.java',
                className: 'com.example.TestRecipe',
                requiredOptions: [],
                isActive: false
            };

            assert.strictEqual(recipe.name, 'TestRecipe');
            assert.strictEqual(recipe.type, RecipeType.Refaster);
            assert.strictEqual(recipe.filePath, '/path/to/recipe.java');
            assert.strictEqual(recipe.className, 'com.example.TestRecipe');
            assert.strictEqual(recipe.isActive, false);
            assert.strictEqual(recipe.id, 'test-recipe-id');
            assert.strictEqual(recipe.displayName, 'Test Recipe Display');
        });

        test('Recipe with required options should be valid', () => {
            const recipe: Recipe = {
                id: 'configurable-recipe-id',
                name: 'ConfigurableRecipe',
                displayName: 'Configurable Recipe',
                description: 'A configurable recipe for testing',
                type: RecipeType.Visitor,
                filePath: '/path/to/configurable.java',
                className: 'com.example.ConfigurableRecipe',
                isActive: true,
                requiredOptions: [
                    {
                        name: 'includeTests',
                        type: 'boolean',
                        description: 'Include test files',
                        required: true,
                        defaultValue: true
                    },
                    {
                        name: 'targetVersion',
                        type: 'string',
                        description: 'Target Java version',
                        required: true,
                        defaultValue: '17'
                    }
                ]
            };

            assert.ok(recipe.requiredOptions);
            assert.strictEqual(recipe.requiredOptions.length, 2);
            assert.strictEqual(recipe.requiredOptions[0].name, 'includeTests');
            assert.strictEqual(recipe.requiredOptions[1].name, 'targetVersion');
        });
    });

    suite('Repository Model Tests', function() {
        test('BuildStatus enum should have correct values', () => {
            assert.strictEqual(BuildStatus.Unknown, 'unknown');
            assert.strictEqual(BuildStatus.NotBuilt, 'not-built');
            assert.strictEqual(BuildStatus.Building, 'building');
            assert.strictEqual(BuildStatus.Success, 'success');
            assert.strictEqual(BuildStatus.Failed, 'failed');
            assert.strictEqual(BuildStatus.Error, 'error');
        });
    });

    suite('CliResult Model Tests', function() {
        test('CliResult should handle success case', () => {
            const result: CliResult = {
                success: true,
                data: { message: 'Command executed successfully' },
                exitCode: 0,
                stdout: 'Command executed successfully'
            };

            assert.strictEqual(result.success, true);
            assert.ok(result.data);
            assert.strictEqual(result.exitCode, 0);
            assert.strictEqual(result.stdout, 'Command executed successfully');
        });

        test('CliResult should handle error case', () => {
            const result: CliResult = {
                success: false,
                error: 'Command failed: File not found',
                exitCode: 1,
                stderr: 'File not found'
            };

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, 'Command failed: File not found');
            assert.strictEqual(result.exitCode, 1);
            assert.strictEqual(result.stderr, 'File not found');
        });

        test('CliResult should handle partial data', () => {
            const result: CliResult = {
                success: false,
                stdout: 'Partial output',
                error: 'Warning: deprecated flag used',
                exitCode: 0
            };

            // Even with exitCode 0, success can be false if there were warnings
            assert.strictEqual(result.success, false);
            assert.ok(result.stdout && result.stdout.length > 0);
            assert.ok(result.error && result.error.length > 0);
        });

        test('CliResult should handle optional fields', () => {
            const result: CliResult = {
                success: true,
                data: 'Fast command result',
                exitCode: 0
            };

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data, 'Fast command result');
            assert.strictEqual(result.exitCode, 0);
        });
    });

    suite('Model Validation Tests', function() {
        test('Recipe validation should detect invalid types', () => {
            // TypeScript will catch this at compile time, but we can test runtime behavior
            const invalidRecipe = {
                name: 'Invalid',
                type: 'invalid-type' as RecipeType,
                filePath: '/invalid/path',
                className: 'Invalid',
                isActive: false
            };

            // The type assertion allows this to compile, but we can check it
            assert.ok(!Object.values(RecipeType).includes(invalidRecipe.type));
        });

        test('CliResult should handle edge cases', () => {
            const edgeCaseResult: CliResult = {
                success: true,
                stdout: '',  // Empty but successful
                exitCode: 0
            };

            assert.strictEqual(edgeCaseResult.success, true);
            assert.strictEqual(edgeCaseResult.stdout, '');
            assert.strictEqual(edgeCaseResult.exitCode, 0);
        });
    });
});