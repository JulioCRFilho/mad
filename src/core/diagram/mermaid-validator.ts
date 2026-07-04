// DOMPurify shim for Node.js (VS Code extension context).
// Mermaid's parser internally calls DOMPurify.addHook during initialization.
// We provide no-op stubs since we only validate syntax, not sanitize HTML.
(globalThis as any).DOMPurify = {
    addHook: () => {},
    sanitize: (dirty: string) => dirty,
    setConfig: () => {},
    clearConfig: () => {},
    removeAllHooks: () => {},
    removeHook: () => {},
    removeHooks: () => {},
    isValidAttribute: () => true,
};

import mermaid from 'mermaid';

/**
 * Validates Mermaid diagram syntax using the real Mermaid parser (mermaid.parse).
 *
 * Returns the first error encountered. mermaid.parse() is synchronous; the
 * async DOMPurify callback triggered after parse() is harmless and silently
 * caught by VS Code's extension host.
 */
export function validateMermaidSyntax(diagramCode: string): { valid: boolean; error?: string } {
    try {
        (mermaid as any).parse(diagramCode);
        return { valid: true };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const firstLine = message.split('\n')[0].trim();
        return {
            valid: false,
            error: firstLine || 'Unknown Mermaid parse error'
        };
    }
}