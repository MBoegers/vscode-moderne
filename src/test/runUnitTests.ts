#!/usr/bin/env node

/**
 * Test runner for true unit tests that don't require VSCode
 * These tests can run in any Node.js environment
 */

import * as path from 'path';
import * as glob from 'glob';

export function run(): Promise<void> {
    // Create the mocha test runner for unit tests only
    const Mocha = require('mocha');
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000,
        slow: 2000
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        // Only include true unit tests that don't require VSCode
        const unitTestPattern = '**/unit/**.test.js';

        glob.glob(unitTestPattern, { cwd: testsRoot }, (err: Error | null, files: string[]) => {
            if (err) {
                return reject(err);
            }

            if (files.length === 0) {
                console.log('No unit test files found matching pattern:', unitTestPattern);
                console.log('Searched in:', testsRoot);
                return resolve();
            }

            console.log(`Found ${files.length} unit test files:`);
            files.forEach(file => {
                console.log(`  - ${file}`);
                mocha.addFile(path.resolve(testsRoot, file));
            });

            try {
                // Run the mocha test
                mocha.run((failures: number) => {
                    if (failures > 0) {
                        reject(new Error(`${failures} unit tests failed.`));
                    } else {
                        console.log('✅ All unit tests passed!');
                        resolve();
                    }
                });
            } catch (err) {
                console.error('Error running unit tests:', err);
                reject(err);
            }
        });
    });
}

// Run if called directly
if (require.main === module) {
    run().catch(err => {
        console.error('Unit test runner failed:', err);
        process.exit(1);
    });
}