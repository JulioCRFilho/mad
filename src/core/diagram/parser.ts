//@::graph TD

import * as vscode from 'vscode';

/**
 * Checks if a position in a line is inside a string literal (single/double quote or backtick).
 * Tracks quote state with escape handling to avoid false positives when //@ appears in strings.
 */
//@isInsideString
export function isInsideString(line: string, pos: number): boolean {
    let inSingle = false;
    let inDouble = false;
    let inBacktick = false;
    //@isInsideString1:Track quote state character by character
    for (let i = 0; i < pos; i++) {
        const ch = line[i];
        const prev = i > 0 ? line[i - 1] : '';
        if (ch === "'" && !inDouble && !inBacktick && prev !== '\\') inSingle = !inSingle;
        else if (ch === '"' && !inSingle && !inBacktick && prev !== '\\') inDouble = !inDouble;
        else if (ch === '`' && !inSingle && !inDouble && prev !== '\\') inBacktick = !inBacktick;
    }
    //@isInsideString1->isInsideString2:Return whether position is inside a string
    //@isInsideString2:Boolean result returned
    return inSingle || inDouble || inBacktick;
}

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
//@readDiagramTypeFromText
export function readDiagramTypeFromText(text: string): string {
    //@readDiagramTypeFromText1:Split text into lines
    const lines = text.split(/\r?\n/);
    //@readDiagramTypeFromText1->readDiagramTypeFromText2:Scan for @:: directive
    //@readDiagramTypeFromText2:Loop over lines to find directive
    for (const line of lines) {
        //@readDiagramTypeFromText2->readDiagramTypeFromText3:Match @:: pattern on line
        //@readDiagramTypeFromText3:Pattern matched
        const match = line.match(/\/\/\s*@::(.+)/);
        //@readDiagramTypeFromText3->readDiagramTypeFromText4:Guard against string-literal false positive
        //@readDiagramTypeFromText4:String-literal check passed
        if (match && !isInsideString(line, match.index!)) {
            return match[1].trim();
        }
    }
    //@readDiagramTypeFromText2->readDiagramTypeFromText5:No directive found — fallback
    //@readDiagramTypeFromText5:Fallback returned
    return 'flowchart TD';
}

/**
 * Reads the diagram type from the file.
 */
export function readDiagramType(document: vscode.TextDocument): string {
    return readDiagramTypeFromText(document.getText());
}

/**
 * Filters all //@ or // @ nodes from the document.
 */
export function filterAllNodes(document: vscode.TextDocument): NodeInfo[] {
    return filterAllNodesFromText(document.getText());
}

//@filterAllNodesFromText
export function filterAllNodesFromText(text: string): NodeInfo[] {
    const allNodes: NodeInfo[] = [];
    const lines = text.split(/\r?\n/);

    //@filterAllNodesFromText1:Iterate each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        //@filterAllNodesFromText1->filterAllNodesFromText2:Guard against string-literal false positives
        const atIndex = line.indexOf('//@');
        //@filterAllNodesFromText2:String-literal check done
        if (atIndex >= 0 && isInsideString(line, atIndex)) {
            let hasRealTag = false;
            let searchFrom = atIndex + 3;
            while (searchFrom < line.length) {
                const next = line.indexOf('//@', searchFrom);
                if (next < 0) break;
                if (!isInsideString(line, next)) { hasRealTag = true; break; }
                searchFrom = next + 3;
            }
            if (!hasRealTag) continue;
        }

        //@filterAllNodesFromText2->filterAllNodesFromText3:Try 12 arrow patterns in sequence
        const classArrowMatch = line.match(/\/\/\s*@(<\|--|--|\*--|o--)([\w.]+)(?::([^\n]+))?/);
        //@filterAllNodesFromText3:All 12 patterns tried (ordered by specificity)
        if (classArrowMatch) {
            allNodes.push({ line: i, id: classArrowMatch[2], description: classArrowMatch[3] ? classArrowMatch[3].trim() : null, isArrow: true, arrowPrefix: classArrowMatch[1] });
            continue;
        }

        const arrowDoubleExplicitMatch = line.match(/\/\/\s*@->>([\w.]+)(?::([^\n]+))?/);
        if (arrowDoubleExplicitMatch) {
            allNodes.push({ line: i, id: arrowDoubleExplicitMatch[1], description: arrowDoubleExplicitMatch[2] ? arrowDoubleExplicitMatch[2].trim() : null, isArrow: true, arrowPrefix: '-->' });
            continue;
        }

        const arrowExplicitMatch = line.match(/\/\/\s*@->([\w.]+)(?::([^\n]+))?/);
        if (arrowExplicitMatch) {
            allNodes.push({ line: i, id: arrowExplicitMatch[1], description: arrowExplicitMatch[2] ? arrowExplicitMatch[2].trim() : null, isArrow: true, arrowPrefix: '-->' });
            continue;
        }

        const arrowInlineDoubleMatch = line.match(/\/\/\s*@([\w.]+)-->([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineDoubleMatch) {
            allNodes.push({ line: i, id: `${arrowInlineDoubleMatch[1]}->${arrowInlineDoubleMatch[2]}`, description: arrowInlineDoubleMatch[3] ? arrowInlineDoubleMatch[3].trim() : null, isArrow: true });
            continue;
        }

        const arrowInlineSequenceMatch = line.match(/\/\/\s*@([\w.]+)->>([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineSequenceMatch) {
            allNodes.push({ line: i, id: `${arrowInlineSequenceMatch[1]}->${arrowInlineSequenceMatch[2]}`, description: arrowInlineSequenceMatch[3] ? arrowInlineSequenceMatch[3].trim() : null, isArrow: true, arrowPrefix: '->>' });
            continue;
        }

        const arrowInlineStepMatch = line.match(/\/\/\s*@([\w.]+)->([\d.]+)>([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineStepMatch) {
            allNodes.push({ line: i, id: `${arrowInlineStepMatch[1]}->${arrowInlineStepMatch[3]}`, description: arrowInlineStepMatch[4] ? arrowInlineStepMatch[4].trim() : null, isArrow: true, arrowPrefix: '->>', stepNumber: arrowInlineStepMatch[2] });
            continue;
        }

        const arrowInlineDashMatch = line.match(/\/\/\s*@([\w.]+)--([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineDashMatch) {
            allNodes.push({ line: i, id: `${arrowInlineDashMatch[1]}->${arrowInlineDashMatch[2]}`, description: arrowInlineDashMatch[3] ? arrowInlineDashMatch[3].trim() : null, isArrow: true, arrowPrefix: '--' });
            continue;
        }

        const arrowInlineStarMatch = line.match(/\/\/\s*@([\w.]+)\*--([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineStarMatch) {
            allNodes.push({ line: i, id: `${arrowInlineStarMatch[1]}->${arrowInlineStarMatch[2]}`, description: arrowInlineStarMatch[3] ? arrowInlineStarMatch[3].trim() : null, isArrow: true, arrowPrefix: '*--' });
            continue;
        }

        const arrowInlineInheritMatch = line.match(/\/\/\s*@([\w.]+)<\|--([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineInheritMatch) {
            allNodes.push({ line: i, id: `${arrowInlineInheritMatch[1]}->${arrowInlineInheritMatch[2]}`, description: arrowInlineInheritMatch[3] ? arrowInlineInheritMatch[3].trim() : null, isArrow: true, arrowPrefix: '<|--' });
            continue;
        }

        const arrowInlineCircleMatch = line.match(/\/\/\s*@([\w.]+)\s*o--([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineCircleMatch) {
            allNodes.push({ line: i, id: `${arrowInlineCircleMatch[1]}->${arrowInlineCircleMatch[2]}`, description: arrowInlineCircleMatch[3] ? arrowInlineCircleMatch[3].trim() : null, isArrow: true, arrowPrefix: 'o--' });
            continue;
        }

        const arrowInlineMatch = line.match(/\/\/\s*@([\w.]+)->([\w.]+)(?::([^\n]+))?/);
        if (arrowInlineMatch) {
            allNodes.push({ line: i, id: `${arrowInlineMatch[1]}->${arrowInlineMatch[2]}`, description: arrowInlineMatch[3] ? arrowInlineMatch[3].trim() : null, isArrow: true });
            continue;
        }

        const tagMatch = line.match(/\/\/\s*@([\w.]+)(?::([^\n]+))?/);
        if (tagMatch) {
            allNodes.push({ line: i, id: tagMatch[1], description: tagMatch[2] ? tagMatch[2].trim() : null, isArrow: false });
        }
    }

    //@filterAllNodesFromText1->filterAllNodesFromText4:Return collected node array
    //@filterAllNodesFromText4:All parsed nodes returned
    return allNodes;
}

//@splitNodes
export function splitNodes(
    allNodes: NodeInfo[]
): {
    retroPointers: Array<{ line: number; id: string; description: string | null }>;
    forwardPointers: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string; stepNumber?: string }>;
} {
    const retroPointers: Array<{ line: number; id: string; description: string | null }> = [];
    const forwardPointers: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string; stepNumber?: string }> = [];

    //@splitNodes1:Classify each node as retro or forward
    for (const node of allNodes) {
        if (node.isArrow) {
            forwardPointers.push({ line: node.line, id: node.id, description: node.description, arrowPrefix: node.arrowPrefix, stepNumber: node.stepNumber });
        } else {
            retroPointers.push({ line: node.line, id: node.id, description: node.description });
        }
    }

    //@splitNodes1->splitNodes2:Return both arrays
    //@splitNodes2:Split result returned
    return { retroPointers, forwardPointers };
}

export function filterGroups(nodes: ProcessedNode[]): ProcessedNode[] {
    return nodes.filter(node => !/\d/.test(node.id));
}

export function filterPrefix(nodes: ProcessedNode[]): ProcessedNode[] {
    return nodes.filter(node => /^[a-zA-Z_]+[0-9]+$/.test(node.id));
}

export function filterSequences(nodes: ProcessedNode[]): ProcessedNode[] {
    return nodes.filter(node => /\.[0-9]+/.test(node.id));
}