import * as path from 'path';
import * as glob from 'glob';

export function run(): Promise<void> {
    // Create the mocha test
    const Mocha = require('mocha');
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 30000, // Increased timeout for integration tests
        slow: 5000      // Mark tests as slow if they take more than 5s
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        // Include both unit and integration tests
        const patterns = [
            '**/**.test.js',           // Standard unit tests
            '**/integration/**.test.js' // Integration tests
        ];

        let allFiles: string[] = [];
        let completedPatterns = 0;

        patterns.forEach(pattern => {
            glob.glob(pattern, { cwd: testsRoot }, (err: Error | null, files: string[]) => {
                if (err) {
                    return reject(err);
                }

                allFiles = allFiles.concat(files);
                completedPatterns++;

                if (completedPatterns === patterns.length) {
                    // Remove duplicates and add files to test suite
                    const uniqueFiles = [...new Set(allFiles)];
                    
                    console.log(`Found ${uniqueFiles.length} test files:`);
                    uniqueFiles.forEach(file => {
                        console.log(`  - ${file}`);
                        mocha.addFile(path.resolve(testsRoot, file));
                    });

                    try {
                        // Run the mocha test
                        mocha.run((failures: number) => {
                            if (failures > 0) {
                                reject(new Error(`${failures} tests failed.`));
                            } else {
                                resolve();
                            }
                        });
                    } catch (err) {
                        console.error(err);
                        reject(err);
                    }
                }
            });
        });
    });
}