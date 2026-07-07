//@::graph

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
 */
//@validateMermaidSyntax
export function validateMermaidSyntax(diagramCode: string): { valid: boolean; error?: string } {
    //@validateMermaidSyntax1:Call mermaid.parse
    try {
        (mermaid as any).parse(diagramCode);
        //@validateMermaidSyntax1->validateMermaidSyntax2:Parse success — return valid
        //@validateMermaidSyntax2:Diagram valid
        return { valid: true };
    //@validateMermaidSyntax1->validateMermaidSyntax3:Parse threw — catch error
    //@validateMermaidSyntax3:Parse error caught
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const firstLine = message.split('\n')[0].trim();
        //@validateMermaidSyntax3->validateMermaidSyntax4:Extract first error line
        //@validateMermaidSyntax4:Error line extracted and returned
        return {
            valid: false,
            error: firstLine || 'Unknown Mermaid parse error'
        };
    }
}