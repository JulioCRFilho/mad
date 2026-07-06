/**
 * Quick smoke test for the MAD HTTP server handler.
 * Run with: node --experimental-vm-modules test-server.mjs
 * 
 * Requires DOMPurify shim for the Mermaid validator (same as mermaid-validator.ts).
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// DOMPurify shim (same as src/core/diagram/mermaid-validator.ts)
globalThis.DOMPurify = {
    addHook: () => {},
    sanitize: (dirty) => dirty,
    setConfig: () => {},
    clearConfig: () => {},
    removeAllHooks: () => {},
    removeHook: () => {},
    removeHooks: () => {},
    isValidAttribute: () => true,
};

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the compiled handler
const handlerPath = resolve(__dirname, 'out/src/core/server/handler.js');
const { validateFile } = await import(handlerPath);

console.log('=== Test 1: extension.ts (should succeed with diagram) ===');
const result1 = validateFile(resolve(__dirname, 'extension.ts'));
console.log(JSON.stringify(result1, null, 2));

console.log('\n=== Test 2: tsconfig.json (no MAD tags) ===');
const result2 = validateFile(resolve(__dirname, 'tsconfig.json'));
console.log(JSON.stringify(result2, null, 2));

console.log('\n=== Test 3: nonexistent file ===');
const result3 = validateFile(resolve(__dirname, 'does-not-exist.ts'));
console.log(JSON.stringify(result3, null, 2));

console.log('\n=== Test 4: package.json (has version string, no MAD tags) ===');
const result4 = validateFile(resolve(__dirname, 'package.json'));
console.log(JSON.stringify(result4, null, 2));