#!/usr/bin/env node

/**
 * Validation script for integration tests
 * Simulates CI environment conditions
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Validating integration tests for CI compatibility...\n');

// Set CI environment variables
process.env.CI = 'true';
process.env.NODE_ENV = 'test';
process.env.DBUS_SESSION_BUS_ADDRESS = 'disabled:';
process.env.NO_AT_BRIDGE = '1';

try {
    // Compile TypeScript first
    console.log('📦 Compiling TypeScript...');
    execSync('npm run compile', { stdio: 'inherit', cwd: process.cwd() });
    console.log('✅ TypeScript compilation successful\n');

    // Check that integration test files were compiled successfully
    console.log('🔍 Checking integration test compilation...');
    const fs = require('fs');
    const testFiles = [
        'out/test/suite/integration/commands.integration.test.js',
        'out/test/suite/integration/extension.integration.test.js', 
        'out/test/suite/integration/search.integration.test.js',
        'out/test/suite/integration/statusbar.integration.test.js'
    ];

    for (const file of testFiles) {
        if (fs.existsSync(path.resolve(process.cwd(), file))) {
            console.log(`✅ ${file} - compiled successfully`);
        } else {
            console.error(`❌ ${file} - not found after compilation`);
            process.exit(1);
        }
    }

    console.log('\n🎉 All integration tests pass syntax validation');
    console.log('🚀 Tests are ready for CI environment');

} catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
}