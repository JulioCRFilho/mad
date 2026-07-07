//@::graph TD

import * as vscode from 'vscode';
import { ProcessedNode, filterAllNodes, filterAllNodesFromText, splitNodes } from '../../diagram/parser';
import { extractIdentifierBelow, formatCodeToLabel } from '../../diagram/identifier';

/**
 * Extracts the source code below a tag, skipping lines that are only consecutive tags.
 */
export function extractCodeLine(document: vscode.TextDocument, tagLine: number): string | null {
    const lines = document.getText().split(/\r?\n/);
    return extractCodeLineFromLines(lines, tagLine);
}

/**
 * Extracts the source code below a tag from raw lines (no vscode.TextDocument needed).
 */
//@extractCodeLineFromLines
export function extractCodeLineFromLines(lines: string[], tagLine: number): string | null {
    //@extractCodeLineFromLines1:Skip consecutive tag lines
    let j = tagLine + 1;
    while (j < lines.length && lines[j].match(/\/\/\s*@/)) {
        j++;
    }
    //@extractCodeLineFromLines1->extractCodeLineFromLines2:Return first non-tag code line
    //@extractCodeLineFromLines2:Code line extracted and returned
    if (j < lines.length) {
        return lines[j].replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return null;
}

/**
 * Extracts a complete SQL code block (multiline) for ER diagrams
 */
export function extractSQLBlock(document: vscode.TextDocument, tagLine: number): string | null {
    const lines = document.getText().split(/\r?\n/);
    return extractSQLBlockFromLines(lines, tagLine);
}

/**
 * Extracts a complete SQL code block from raw lines (no vscode.TextDocument needed).
 */
//@extractSQLBlockFromLines
export function extractSQLBlockFromLines(lines: string[], tagLine: number): string | null {
    //@extractSQLBlockFromLines1:Skip consecutive tag lines
    let j = tagLine + 1;
    while (j < lines.length && lines[j].match(/\/\/\s*@/)) {
        j++;
    }

    if (j >= lines.length) return null;

    //@extractSQLBlockFromLines1->extractSQLBlockFromLines2:Accumulate SQL until semicolon
    //@extractSQLBlockFromLines2:SQL block accumulated
    const codeLines: string[] = [];
    while (j < lines.length) {
        const line = lines[j];
        if (line.match(/\/\/\s*@/)) break;
        codeLines.push(line);
        if (line.includes(';')) break;
        j++;
    }

    return codeLines.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Two-pass matching for forward-to-retro node resolution.
 * Pass 1: match by ClassDiagram group for inherited/composition arrows.
 * Pass 2: match by identical code line.
 * Pass 3: fallback to closest numbered retro node above.
 */
//@findRetroNodeForLine
export function findRetroNodeForLine(
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    document: vscode.TextDocument,
    forwardLine: number,
    arrowPrefix?: string
): { id: string; line: number } | null {
    //@findRetroNodeForLine1:Pass 1 — ClassDiagram group match
    if (arrowPrefix && ['*--', '<|--', 'o--'].includes(arrowPrefix)) {
        let closestGroup: { id: string; line: number } | null = null;
        for (const retro of retroNodes) {
            if (retro.line < forwardLine && (!closestGroup || retro.line > closestGroup.line)) {
                if (!/\d/.test(retro.id)) {
                    closestGroup = { id: retro.id, line: retro.line };
                }
            }
        }
        return closestGroup;
    }

    //@findRetroNodeForLine2:Pass 2 — match by identical code line
    const codeLine = extractCodeLine(document, forwardLine);
    if (codeLine) {
        for (const retro of retroNodes) {
            const retroCodeLine = extractCodeLine(document, retro.line);
            if (retroCodeLine === codeLine) {
                return { id: retro.id, line: retro.line };
            }
        }
    }

    //@findRetroNodeForLine3:Pass 3 — closest numbered retro above
    let closest: { id: string; line: number } | null = null;
    for (const retro of retroNodes) {
        if (retro.line < forwardLine && (!closest || retro.line > closest.line)) {
            if (/^[a-zA-Z_]+\d+$/.test(retro.id)) {
                closest = { id: retro.id, line: retro.line };
            }
        }
    }
    return closest;
}

/**
 * Process ALL retro nodes: extracts code, formats label.
 */
//@processRetroPointers
export function processRetroPointers(
    document: vscode.TextDocument,
    retroPointers: Array<{ line: number; id: string; description: string | null }>,
    prefix: string,
    isERDiagramOrType: boolean | string = false
): Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string }> }> {
    const isERDiagram = typeof isERDiagramOrType === 'string'
        ? isERDiagramOrType.toLowerCase().startsWith('erdiagram')
        : isERDiagramOrType;
    const isFlowchart = typeof isERDiagramOrType === 'string'
        ? isERDiagramOrType.toLowerCase().startsWith('flowchart') || isERDiagramOrType.toLowerCase().startsWith('graph')
        : false;
    const result: Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string }> }> = [];

    //@processRetroPointers1:Iterate retro nodes
    for (const node of retroPointers) {
        const isGroup = !/\d/.test(node.id);

        let label: string;
        //@processRetroPointers1->processRetroPointers2:Determine label by diagram type
        //@processRetroPointers2:Label determined
        if (isERDiagram && isGroup) {
            const sqlBlock = extractSQLBlock(document, node.line);
            label = sqlBlock || node.id;
        } else {
            const codeLine = extractCodeLine(document, node.line);
            const identifier = codeLine ? extractIdentifierBelow(codeLine) : null;
            const fromCode = identifier ? formatCodeToLabel(identifier) : null;
            const isEntry = /^[a-zA-Z_]+\d+$/.test(node.id);
            const hasDots = /\.\d/.test(node.id);
            if (isGroup) {
                label = node.id;
            } else if (isFlowchart && hasDots && node.description) {
                label = node.description;
            } else if (isEntry && node.description) {
                label = node.description;
            } else {
                label = fromCode || node.description || node.id;
            }
        }

        result.push({
            line: node.line,
            id: node.id,
            label: label,
            description: node.description,
            connections: []
        });
    }

    return result;
}

/**
 * Groups consecutive forward pointers (same line) into a single synthetic node
 */
function groupConsecutiveForwardPointers(
    forwardPointers: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string; stepNumber?: string }>
): Array<{ line: number; ids: string[]; descriptions: Map<string, string>; arrowPrefixes: Map<string, string>; stepNumbers: Map<string, string> }> {
    const grouped: Array<{ line: number; ids: string[]; descriptions: Map<string, string>; arrowPrefixes: Map<string, string>; stepNumbers: Map<string, string> }> = [];

    for (const node of forwardPointers) {
        const existing = grouped.find(g => g.line === node.line);
        if (existing) {
            existing.ids.push(node.id);
            if (node.description) { existing.descriptions.set(node.id, node.description); }
            if (node.arrowPrefix) { existing.arrowPrefixes.set(node.id, node.arrowPrefix); }
            if (node.stepNumber) { existing.stepNumbers.set(node.id, node.stepNumber); }
        } else {
            grouped.push({
                line: node.line,
                ids: [node.id],
                descriptions: node.description ? new Map([[node.id, node.description]]) : new Map(),
                arrowPrefixes: node.arrowPrefix ? new Map([[node.id, node.arrowPrefix]]) : new Map(),
                stepNumbers: node.stepNumber ? new Map([[node.id, node.stepNumber]]) : new Map()
            });
        }
    }

    return grouped;
}

/**
 * Processes forward nodes (arrow-to-target syntax).
 * Route 1: direct connections (source->target syntax).
 * Route 2: match to existing retro nodes, or create synthetic nodes.
 */
//@processForwardPointers
export function processForwardPointers(
    document: vscode.TextDocument,
    forwardPointers: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string; stepNumber?: string }>,
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    _prefix: string
): {
    syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string; arrowPrefix?: string; stepNumber?: string }> }>;
    extraConnections: Array<{ sourceId: string; targetId: string; label: string; line: number; arrowPrefix?: string; stepNumber?: string }>;
    orderedDirectConnections: Array<{ sourceId: string; targetId: string; label: string; line: number; arrowPrefix?: string; stepNumber?: string }>;
} {
    const syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string; arrowPrefix?: string; stepNumber?: string }> }> = [];
    const extraConnections: Array<{ sourceId: string; targetId: string; label: string; line: number; arrowPrefix?: string; stepNumber?: string }> = [];
    const orderedDirectConnections: Array<{ sourceId: string; targetId: string; label: string; line: number; arrowPrefix?: string; stepNumber?: string }> = [];

    const regularForward: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string }> = [];

    //@processForwardPointers1:Route 1 — extract direct connections
    for (const node of forwardPointers) {
        if (node.id.includes('->')) {
            const [source, target] = node.id.split('->');
            if (source && target) {
                orderedDirectConnections.push({
                    sourceId: source.trim(),
                    targetId: target.trim(),
                    label: node.description || '',
                    line: node.line,
                    arrowPrefix: node.arrowPrefix,
                    stepNumber: node.stepNumber
                });
            }
        } else {
            regularForward.push(node);
        }
    }

    //@processForwardPointers1->processForwardPointers2:Route 2 — match to retro or create synthetic
    //@processForwardPointers2:Forward nodes resolved
    const grouped = groupConsecutiveForwardPointers(regularForward);

    for (const group of grouped) {
        const firstArrowPrefix = group.ids.length > 0 ? group.arrowPrefixes.get(group.ids[0]) : undefined;
        const existingRetro = findRetroNodeForLine(retroNodes, document, group.line, firstArrowPrefix);

        if (existingRetro) {
            for (const targetId of group.ids) {
                extraConnections.push({
                    sourceId: existingRetro.id,
                    targetId: targetId,
                    label: group.descriptions.get(targetId) || '',
                    line: group.line,
                    arrowPrefix: group.arrowPrefixes.get(targetId),
                    stepNumber: group.stepNumbers.get(targetId)
                });
            }
        } else {
            //@processForwardPointers2.1:Synthetic node created (no retro match)
            const codeLine = extractCodeLine(document, group.line);
            const identifier = codeLine ? extractIdentifierBelow(codeLine) : null;
            const sourceName = identifier || 'Unknown';
            const syntheticId = `${sourceName}_${group.line}`;
            const label = identifier ? formatCodeToLabel(identifier) : sourceName;

            const connections = group.ids.map(targetId => ({
                id: targetId,
                label: group.descriptions.get(targetId) || '',
                stepNumber: group.stepNumbers.get(targetId),
                line: group.line
            }));

            syntheticNodes.push({
                line: group.line,
                id: syntheticId,
                label: label,
                connections: connections
            });
        }
    }

    return { syntheticNodes, extraConnections, orderedDirectConnections };
}

/**
 * Filters nodes by type, adds extra connections from forwards,
 * removes duplicates and sorts.
 */
//@filterAndSortNodes
export function filterAndSortNodes(
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string; arrowPrefix?: string; stepNumber?: string; line?: number }> }>,
    extraConnections: Array<{ sourceId: string; targetId: string; label: string; line: number; arrowPrefix?: string; stepNumber?: string }>
): ProcessedNode[] {
    //@filterAndSortNodes1:Merge retro and synthetic into node list
    const allNodes: Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string; arrowPrefix?: string; stepNumber?: string; line?: number }> }> = [
        ...retroNodes.map(n => ({ ...n, connections: [] as Array<{ id: string; label: string; arrowPrefix?: string; stepNumber?: string; line?: number }> })),
        ...syntheticNodes.map(n => ({ ...n, description: null as string | null, connections: n.connections || [] }))
    ];

    //@filterAndSortNodes1->filterAndSortNodes2:Attach extra connections to source nodes
    //@filterAndSortNodes2:Extra connections attached
    for (const conn of extraConnections) {
        const sourceNode = allNodes.find(n => n.id === conn.sourceId);
        if (sourceNode) {
            sourceNode.connections.push({ 
                id: conn.targetId, 
                label: conn.label, 
                arrowPrefix: conn.arrowPrefix,
                stepNumber: conn.stepNumber,
                line: conn.line
            });
        }
    }

    //@filterAndSortNodes2->filterAndSortNodes3:Normalize and deduplicate by ID
    //@filterAndSortNodes3:Nodes normalized and deduped
    const normalized = allNodes.map(node => ({
        line: node.line,
        id: node.id,
        label: node.label || node.id,
        description: node.description || null,
        connections: node.connections || []
    })) as ProcessedNode[];

    const unique = normalized.filter((node, index, self) =>
        index === self.findIndex(n => n.id === node.id)
    );

    return unique;
}

export interface RelatedTagsResult {
    nodes: ProcessedNode[];
    orderedDirectConnections: Array<{ sourceId: string; targetId: string; label: string; line: number; arrowPrefix?: string; stepNumber?: string }>;
}

/**
 * Full pipeline: filter nodes → split retro/forward → process retro → process forward →
 * filter, sort, merge ordered connections, and return.
 * This is the core tag-to-node pipeline used by VSCode commands.
 */
//@findRelatedTagsWithOrder
export function findRelatedTagsWithOrder(
    document: vscode.TextDocument,
    prefix: string,
    diagramType: string
): RelatedTagsResult {
    //@findRelatedTagsWithOrder1:Filter and split all MAD nodes
    const allNodes = filterAllNodes(document);
    const { retroPointers, forwardPointers } = splitNodes(allNodes);

    //@findRelatedTagsWithOrder1->findRelatedTagsWithOrder2:Process retro and forward pointers
    //@findRelatedTagsWithOrder2:Retro and forward nodes processed
    const processedRetro = processRetroPointers(document, retroPointers, prefix, diagramType);
    const { syntheticNodes, extraConnections, orderedDirectConnections } = processForwardPointers(document, forwardPointers, processedRetro, prefix);

    //@findRelatedTagsWithOrder2->findRelatedTagsWithOrder3:Filter, sort, and return result
    //@findRelatedTagsWithOrder3:Result with ordered connections returned
    return {
        nodes: filterAndSortNodes(processedRetro, syntheticNodes, extraConnections),
        orderedDirectConnections
    };
}

/**
 * Convenience: calls findRelatedTagsWithOrder and merges ordered connections
 * into ProcessedNode[].connections for backward compatibility.
 */
export function findRelatedTags(
    document: vscode.TextDocument,
    prefix: string,
    diagramType: string
): ProcessedNode[] {
    const result = findRelatedTagsWithOrder(document, prefix, diagramType);

    for (const conn of result.orderedDirectConnections) {
        const sourceNode = result.nodes.find(n => n.id === conn.sourceId);
        if (sourceNode) {
            const alreadyPresent = sourceNode.connections.some(
                c => c.id === conn.targetId && c.label === conn.label
            );
            if (!alreadyPresent) {
                sourceNode.connections.push({ 
                    id: conn.targetId, 
                    label: conn.label, 
                    arrowPrefix: conn.arrowPrefix,
                    stepNumber: conn.stepNumber,
                    line: conn.line
                });
            }
        }
    }

    return result.nodes;
}

// ── Text-based variants (no vscode.TextDocument required) ──

//@RetroMatcherFromText
export function findRetroNodeForLineFromLines(
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    lines: string[],
    forwardLine: number,
    arrowPrefix?: string
): { id: string; line: number } | null {
    //@RetroMatcherFromText1:Pass 1 — ClassDiagram group match (text)
    if (arrowPrefix && ['*--', '<|--', 'o--'].includes(arrowPrefix)) {
        let closestGroup: { id: string; line: number } | null = null;
        for (const retro of retroNodes) {
            if (retro.line < forwardLine && (!closestGroup || retro.line > closestGroup.line)) {
                if (!/\d/.test(retro.id)) {
                    closestGroup = { id: retro.id, line: retro.line };
                }
            }
        }
        return closestGroup;
    }

    //@RetroMatcherFromText2:Pass 2 — match by identical code line (text)
    const codeLine = extractCodeLineFromLines(lines, forwardLine);
    if (codeLine) {
        for (const retro of retroNodes) {
            const retroCodeLine = extractCodeLineFromLines(lines, retro.line);
            if (retroCodeLine === codeLine) {
                return { id: retro.id, line: retro.line };
            }
        }
    }

    //@RetroMatcherFromText3:Pass 3 — closest numbered retro above (text)
    let closest: { id: string; line: number } | null = null;
    for (const retro of retroNodes) {
        if (retro.line < forwardLine && (!closest || retro.line > closest.line)) {
            if (/^[a-zA-Z_]+\d+$/.test(retro.id)) {
                closest = { id: retro.id, line: retro.line };
            }
        }
    }
    return closest;
}

//@RetroProcessorFromText
export function processRetroPointersFromLines(
    lines: string[],
    retroPointers: Array<{ line: number; id: string; description: string | null }>,
    prefix: string,
    isERDiagramOrType: boolean | string = false
): Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string }> }> {
    const isERDiagram = typeof isERDiagramOrType === 'string'
        ? isERDiagramOrType.toLowerCase().startsWith('erdiagram')
        : isERDiagramOrType;
    const isFlowchart = typeof isERDiagramOrType === 'string'
        ? isERDiagramOrType.toLowerCase().startsWith('flowchart') || isERDiagramOrType.toLowerCase().startsWith('graph')
        : false;
    const result: Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string }> }> = [];

    //@RetroProcessorFromText1:Iterate retro nodes (text)
    for (const node of retroPointers) {
        const isGroup = !/\d/.test(node.id);

        let label: string;
        //@RetroProcessorFromText1->RetroProcessorFromText2:Determine label (text)
        //@RetroProcessorFromText2:Label determined
        if (isERDiagram && isGroup) {
            const sqlBlock = extractSQLBlockFromLines(lines, node.line);
            label = sqlBlock || node.id;
        } else {
            const codeLine = extractCodeLineFromLines(lines, node.line);
            const identifier = codeLine ? extractIdentifierBelow(codeLine) : null;
            const fromCode = identifier ? formatCodeToLabel(identifier) : null;
            const isEntry = /^[a-zA-Z_]+\d+$/.test(node.id);
            const hasDots = /\.\d/.test(node.id);
            if (isGroup) {
                label = node.id;
            } else if (isFlowchart && hasDots && node.description) {
                label = node.description;
            } else if (isEntry && node.description) {
                label = node.description;
            } else {
                label = fromCode || node.description || node.id;
            }
        }

        result.push({
            line: node.line,
            id: node.id,
            label: label,
            description: node.description,
            connections: []
        });
    }

    return result;
}

//@ForwardProcessorFromText
export function processForwardPointersFromLines(
    lines: string[],
    forwardPointers: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string; stepNumber?: string }>,
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    _prefix: string
): {
    syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string; arrowPrefix?: string; stepNumber?: string }> }>;
    extraConnections: Array<{ sourceId: string; targetId: string; label: string; line: number; arrowPrefix?: string; stepNumber?: string }>;
    orderedDirectConnections: Array<{ sourceId: string; targetId: string; label: string; line: number; arrowPrefix?: string; stepNumber?: string }>;
} {
    const syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string; arrowPrefix?: string; stepNumber?: string }> }> = [];
    const extraConnections: Array<{ sourceId: string; targetId: string; label: string; line: number; arrowPrefix?: string; stepNumber?: string }> = [];
    const orderedDirectConnections: Array<{ sourceId: string; targetId: string; label: string; line: number; arrowPrefix?: string; stepNumber?: string }> = [];

    const regularForward: Array<{ line: number; id: string; description: string | null; arrowPrefix?: string }> = [];

    //@ForwardProcessorFromText1:Route 1 — direct connections (text)
    for (const node of forwardPointers) {
        if (node.id.includes('->')) {
            const [source, target] = node.id.split('->');
            if (source && target) {
                orderedDirectConnections.push({
                    sourceId: source.trim(),
                    targetId: target.trim(),
                    label: node.description || '',
                    line: node.line,
                    arrowPrefix: node.arrowPrefix,
                    stepNumber: node.stepNumber
                });
            }
        } else {
            regularForward.push(node);
        }
    }

    //@ForwardProcessorFromText1->ForwardProcessorFromText2:Route 2 — retro or synthetic (text)
    //@ForwardProcessorFromText2:Forward pointers resolved
    const grouped = groupConsecutiveForwardPointers(regularForward);

    for (const group of grouped) {
        const firstArrowPrefix = group.ids.length > 0 ? group.arrowPrefixes.get(group.ids[0]) : undefined;
        const existingRetro = findRetroNodeForLineFromLines(retroNodes, lines, group.line, firstArrowPrefix);

        if (existingRetro) {
            for (const targetId of group.ids) {
                extraConnections.push({
                    sourceId: existingRetro.id,
                    targetId: targetId,
                    label: group.descriptions.get(targetId) || '',
                    line: group.line,
                    arrowPrefix: group.arrowPrefixes.get(targetId),
                    stepNumber: group.stepNumbers.get(targetId)
                });
            }
        } else {
            //@ForwardProcessorFromText2.1:Synthetic node created (text)
            const codeLine = extractCodeLineFromLines(lines, group.line);
            const identifier = codeLine ? extractIdentifierBelow(codeLine) : null;
            const sourceName = identifier || 'Unknown';
            const syntheticId = `${sourceName}_${group.line}`;
            const label = identifier ? formatCodeToLabel(identifier) : sourceName;

            const connections = group.ids.map(targetId => ({
                id: targetId,
                label: group.descriptions.get(targetId) || '',
                stepNumber: group.stepNumbers.get(targetId),
                line: group.line
            }));

            syntheticNodes.push({
                line: group.line,
                id: syntheticId,
                label: label,
                connections: connections
            });
        }
    }

    return { syntheticNodes, extraConnections, orderedDirectConnections };
}

/**
 * Pipeline from raw text — used by the HTTP server handler.
 * Mirror of findRelatedTagsWithOrder but operates on raw text instead of vscode.TextDocument.
 */
//@findRelatedTagsFromText
export function findRelatedTagsFromText(
    text: string,
    prefix: string,
    diagramType: string
): ProcessedNode[] {
    //@findRelatedTagsFromText1:Parse text and split nodes (text)
    const lines = text.split(/\r?\n/);
    const allNodes = filterAllNodesFromText(text);
    const { retroPointers, forwardPointers } = splitNodes(allNodes);

    //@findRelatedTagsFromText1->findRelatedTagsFromText2:Build and sort processed nodes
    //@findRelatedTagsFromText2:Processed nodes built
    const processedRetro = processRetroPointersFromLines(lines, retroPointers, prefix, diagramType);
    const { syntheticNodes, extraConnections, orderedDirectConnections } =
        processForwardPointersFromLines(lines, forwardPointers, processedRetro, prefix);

    const nodes = filterAndSortNodes(processedRetro, syntheticNodes, extraConnections);

    //@findRelatedTagsFromText2->findRelatedTagsFromText3:Merge ordered connections
    //@findRelatedTagsFromText3:Ordered connections merged and returned
    for (const conn of orderedDirectConnections) {
        const sourceNode = nodes.find(n => n.id === conn.sourceId);
        if (sourceNode) {
            const alreadyPresent = sourceNode.connections.some(
                c => c.id === conn.targetId && c.label === conn.label
            );
            if (!alreadyPresent) {
                sourceNode.connections.push({
                    id: conn.targetId,
                    label: conn.label,
                    arrowPrefix: conn.arrowPrefix,
                    stepNumber: conn.stepNumber,
                    line: conn.line
                });
            }
        }
    }

    return nodes;
}