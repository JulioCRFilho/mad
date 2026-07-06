/**
 * Types for the MAD HTTP server — CLI agent validation endpoint.
 *
 * The server accepts POST /validate with a file path and returns
 * structured results from the same pipeline that fires on VSCode save.
 */

/** Request body for POST /validate */
export interface ValidateRequest {
    /** Absolute path to the source file containing MAD tags */
    filePath: string;
}

/** Successful validation response */
export interface ValidateResponseSuccess {
    status: 'ok';
    /** Path to the generated /tmp/mad-diagram.mermaid file */
    outputFile: string;
    /** The generated Mermaid code */
    mermaidCode: string;
    /** The diagram type detected (e.g. "graph TD", "sequenceDiagram") */
    diagramType: string;
    /** Validation warnings (tag count mismatches, orphan tags, etc.) */
    warnings: string[];
    /** Processing time in milliseconds */
    durationMs: number;
}

/** Error response */
export interface ValidateResponseError {
    status: 'error';
    /** Error classification */
    errorType:
        | 'file_not_found'
        | 'no_mad_tags'
        | 'no_diagram_tag'
        | 'mad_validation_failed'
        | 'mermaid_validation_failed'
        | 'internal_error';
    message: string;
    /** Optional detailed validation errors */
    details?: string[];
}

export type ValidateResponse = ValidateResponseSuccess | ValidateResponseError;