//@::classDiagram

//@DiagramCommandContext
export interface DiagramCommandContext {
    //@DiagramCommandContext1:document
    document: import('vscode').TextDocument;
    //@DiagramCommandContext1.1:prefix
    prefix: string;
    //@DiagramCommandContext1.2:extensionUri
    extensionUri: import('vscode').Uri;
}

//@DiagramResult
export interface DiagramResult {
    //@DiagramResult1:success flag
    success: boolean;
    //@DiagramResult1.1:errorMessage optional
    errorMessage?: string;
}

/**
 * Interface that every diagram command must implement.
 * Each diagram type (flowchart, sequence, class, state, er)
 * has its own implementation with specific Mermaid validation.
 */
//@DiagramCommandHandler
export interface DiagramCommandHandler {
    /** Unique identifier for the diagram type */
    //@DiagramCommandHandler1:type identifier
    type: string;
    /** Checks if this handler matches the given diagram type */
    //@DiagramCommandHandler1.1:matches
    matches(diagramType: string): boolean;
    /** Executes the complete pipeline: validation, processing and display */
    //@DiagramCommandHandler1.2:execute
    execute(context: DiagramCommandContext): DiagramResult;
    /** Generates the diagram without displaying it (for AI agent validation) */
    //@DiagramCommandHandler1.3:generateOnly
    generateOnly(context: DiagramCommandContext): DiagramResult & { code?: string };
    //@DiagramCommandHandler1.3--DiagramCommandContext:uses
    //@DiagramCommandHandler1.3--DiagramResult:returns
}
