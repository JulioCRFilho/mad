import * as vscode from 'vscode';

export interface NodeInfo {
    line: number;
    id: string;
    description: string | null;
    isArrow: boolean;
    /** Arrow type for classDiagram: '-->' (assoc), '--' (dep), '<|--' (inheritance), '*--' (composition), 'o--' (aggregation) */
    arrowPrefix?: string;
    /** Step number for sequence diagram arrows: '1', '1.1', '1.2', etc. */
    stepNumber?: string;
}

export interface ProcessedNode {
    line: number;
    id: string;
    label: string;
    description: string | null;
    /** Step number for sequence diagram arrows: '1', '1.1', '1.2', etc. Only applies to direct connection nodes */
    stepNumber?: string;
    connections: Array<{ id: string; label: string; arrowPrefix?: string; stepNumber?: string; line?: number }>;
}


/**
 * Reads the diagram type from raw text.
 * Expected format: //@::DiagramType or // @::DiagramType
 * Searches all lines.
 * Returns "flowchart TD" as fallback if not found.
 */
export function readDiagramTypeFromText(text: string): string {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        const match = line.match(/\/\/\s*@::(.+)/);
        if (match) {
            return match[1].trim();
        }
    }
    return 'flowchart TD';
}

/**
 * Reads the diagram type from the file.
 * Delegates to readDiagramTypeFromText.
 */
export function readDiagramType(document: vscode.TextDocument): string {
    return readDiagramTypeFromText(document.getText());
}

/**
 * Filters all //@ or // @ nodes from raw text.
 * Works without a vscode.TextDocument so the HTTP server handler
 * can use it directly.
 */
/**
 * Filters all //@ or // @ nodes from the document.
 * Delegates to filterAllNodesFromText.
 */
export function filterAllNodes(document: vscode.TextDocument): NodeInfo[] {
    return filterAllNodesFromText(document.getText());
}

export function filterAllNodesFromText(text: string): NodeInfo[] {
    const allNodes: NodeInfo[] = [];
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Verifica //@--Target, //@<|--Target, //@*--Target, //@o--Target (classDiagram relationships)
        const classArrowMatch = line.match(/\/\/\s*@(<\|--|--|\*--|o--)([\w.]+)(?::([^\n]+))?/);
        if (classArrowMatch) {
            allNodes.push({
                line: i,
                id: classArrowMatch[2],
                description: classArrowMatch[3] ? classArrowMatch[3].trim() : null,
                isArrow: true,
                arrowPrefix: classArrowMatch[1]
            });
            continue;
        }

        // Checks //@->>Target:comment (sequence diagram double arrow)
        // Ex: //@->>Database:SQL query
        const arrowDoubleExplicitMatch = line.match(/\/\/\s*@->>([\w.]+)(?::([^\n]+))?/);
        if (arrowDoubleExplicitMatch) {
            allNodes.push({
                line: i,
                id: arrowDoubleExplicitMatch[1],
                description: arrowDoubleExplicitMatch[2] ? arrowDoubleExplicitMatch[2].trim() : null,
                isArrow: true,
                arrowPrefix: '-->'
            });
            continue;
        }

        // Checks //@->Target:comment (explicit forward pointer)
        // Ex: //@->Server:HTTP Request
        const arrowExplicitMatch = line.match(/\/\/\s*@->([\w.]+)(?::([^\n]+))?/);
        if (arrowExplicitMatch) {
            allNodes.push({
                line: i,
                id: arrowExplicitMatch[1],
                description: arrowExplicitMatch[2] ? arrowExplicitMatch[2].trim() : null,
                isArrow: true,
                arrowPrefix: '-->'
            });
            continue;
        }

        // Checks //@Source-->Target:comment (inline forward pointer with -->)
        // Ex: //@ManagingPartner-->PhoneNumber:contains
        const arrowInlineDoubleMatch = line.match(/\/\/\s*@([\w.]+)-->([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineDoubleMatch) {
            allNodes.push({
                line: i,
                id: `${arrowInlineDoubleMatch[1]}->${arrowInlineDoubleMatch[2]}`,
                description: arrowInlineDoubleMatch[3] ? arrowInlineDoubleMatch[3].trim() : null,
                isArrow: true
            });
            continue;
        }

        // Checks //@Source->>Target:comment (inline sequence diagram with double arrow)
        // Ex: //@Client->>Handler:submit-full
        const arrowInlineSequenceMatch = line.match(/\/\/\s*@([\w.]+)->>([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineSequenceMatch) {
            allNodes.push({
                line: i,
                id: `${arrowInlineSequenceMatch[1]}->${arrowInlineSequenceMatch[2]}`,
                description: arrowInlineSequenceMatch[3] ? arrowInlineSequenceMatch[3].trim() : null,
                isArrow: true,
                arrowPrefix: '->>'
            });
            continue;
        }

        // Checks //@Source->N>Target:comment (sequence diagram with step number in arrow)
        // Ex: //@Provider->1>Provider:Validate input or //@Provider->1.1>Provider:Build multipart body
        // IMPORTANT: This must come BEFORE the general //@Source->Target regex
        const arrowInlineStepMatch = line.match(/\/\/\s*@([\w.]+)->([\d.]+)>([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineStepMatch) {
            allNodes.push({
                line: i,
                id: `${arrowInlineStepMatch[1]}->${arrowInlineStepMatch[3]}`,
                description: arrowInlineStepMatch[4] ? arrowInlineStepMatch[4].trim() : null,
                isArrow: true,
                arrowPrefix: '->>',
                stepNumber: arrowInlineStepMatch[2]  // Store the step number (e.g., "1", "1.1", "1.2")
            });
            continue;
        }

        // Checks //@Source--Target:comment (inline classDiagram association)
        // Ex: //@Payload1--BuildCompanyInfo:uses
        const arrowInlineDashMatch = line.match(/\/\/\s*@([\w.]+)--([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineDashMatch) {
            allNodes.push({
                line: i,
                id: `${arrowInlineDashMatch[1]}->${arrowInlineDashMatch[2]}`,
                description: arrowInlineDashMatch[3] ? arrowInlineDashMatch[3].trim() : null,
                isArrow: true,
                arrowPrefix: '--'
            });
            continue;
        }

        // Checks //@Source*--Target:comment (inline classDiagram composition)
        // Ex: //@OnboardingPersonalInfo*--PhoneNumber:contains
        const arrowInlineStarMatch = line.match(/\/\/\s*@([\w.]+)\*--([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineStarMatch) {
            allNodes.push({
                line: i,
                id: `${arrowInlineStarMatch[1]}->${arrowInlineStarMatch[2]}`,
                description: arrowInlineStarMatch[3] ? arrowInlineStarMatch[3].trim() : null,
                isArrow: true,
                arrowPrefix: '*--'
            });
            continue;
        }

        // Checks //@Source<|--Target:comment (inline classDiagram inheritance)
        // Ex: //@Customer<|--User:inherits
        const arrowInlineInheritMatch = line.match(/\/\/\s*@([\w.]+)<\|--([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineInheritMatch) {
            allNodes.push({
                line: i,
                id: `${arrowInlineInheritMatch[1]}->${arrowInlineInheritMatch[2]}`,
                description: arrowInlineInheritMatch[3] ? arrowInlineInheritMatch[3].trim() : null,
                isArrow: true,
                arrowPrefix: '<|--'
            });
            continue;
        }

        // Checks //@Sourceo--Target:comment (inline classDiagram aggregation)
        // Ex: //@CartItemo--Product:references or //@CartItem o--Product:references
        const arrowInlineCircleMatch = line.match(/\/\/\s*@([\w.]+)\s*o--([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineCircleMatch) {
            allNodes.push({
                line: i,
                id: `${arrowInlineCircleMatch[1]}->${arrowInlineCircleMatch[2]}`,
                description: arrowInlineCircleMatch[3] ? arrowInlineCircleMatch[3].trim() : null,
                isArrow: true,
                arrowPrefix: 'o--'
            });
            continue;
        }

        // Checks //@Source->Target:comment (inline forward pointer)
        // Ex: //@Client->Server:HTTP Request
        const arrowInlineMatch = line.match(/\/\/\s*@([\w.]+)->([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineMatch) {
            allNodes.push({
                line: i,
                id: `${arrowInlineMatch[1]}->${arrowInlineMatch[2]}`,
                description: arrowInlineMatch[3] ? arrowInlineMatch[3].trim() : null,
                isArrow: true
            });
            continue;
        }

        // Checks //@ID:comment (retro pointer)
        const tagMatch = line.match(/\/\/\s*@([\w.]+)(?::([^\n]+))?/);
        if (tagMatch) {
            allNodes.push({
                line: i,
                id: tagMatch[1],
                description: tagMatch[2] ? tagMatch[2].trim() : null,
                isArrow: false
            });
        }
    }

    return allNodes;
}

/**
 * Splits nodes into retro pointers //@ and forward pointers //@->
 */
export function splitNodes(
    allNodes: NodeInfo[]
): {
    retroPointers: Array<{ line: number; id: string; description: string | null }>;
    forwardPointers: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string; stepNumber?: string }>;
} {
    const retroPointers: Array<{ line: number; id: string; description: string | null }> = [];
    const forwardPointers: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string; stepNumber?: string }> = [];

    for (const node of allNodes) {
        if (node.isArrow) {
            forwardPointers.push({
                line: node.line,
                id: node.id,
                description: node.description,
                arrowPrefix: node.arrowPrefix,
                stepNumber: node.stepNumber
            });
        } else {
            retroPointers.push({
                line: node.line,
                id: node.id,
                description: node.description
            });
        }
    }

    return { retroPointers, forwardPointers };
}

/**
 * Filters groups (IDs without numbers)
 */
export function filterGroups(
    nodes: ProcessedNode[]
): ProcessedNode[] {
    return nodes.filter(node => !/\d/.test(node.id));
}

/**
 * Filters entry nodes (prefix+ simple number)
 */
export function filterPrefix(
    nodes: ProcessedNode[]
): ProcessedNode[] {
    return nodes.filter(node => /^[a-zA-Z_]+[0-9]+$/.test(node.id));
}

/**
 * Filters sequence nodes (prefix+ number.number...)
 */
export function filterSequences(
    nodes: ProcessedNode[]
): ProcessedNode[] {
    return nodes.filter(node => /\.[0-9]+/.test(node.id));
}