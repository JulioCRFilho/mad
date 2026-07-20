//@::graph TD

import { filterAllNodes } from '../../diagram/parser';
import { validateDiagram, ValidationResult } from '../../diagram/validator';
import { validateMermaidSyntax } from '../../diagram/mermaid-validator';

export type { ValidationResult } from '../../diagram/validator';

//@TagInfo
export interface TagInfo {
    id: string;
    line: number;
    isConnection: boolean;
    targetIds: string[];
    description?: string | null;
    connections?: Array<{ id: string; label: string; arrowPrefix?: string }>;
}

/**
 * Validates the MAD diagram structure
 */
//@validateMADStructure
export function validateMADStructure(document: import('vscode').TextDocument, prefix: string): ValidationResult {
    const allNodes = filterAllNodes(document);
    return validateDiagram(allNodes, prefix);
}

/**
 * Parses all MAD tags from text, classifying each by its arrow type.
 * Handles 8 different tag syntaxes: step-number, sequence double, implicit, explicit,
 * class inline, class bare, and normal retro pointers.
 */
//@parseAllTags
export function parseAllTags(text: string, lines: string[]): TagInfo[] {
    const allTags: TagInfo[] = [];
    //@parseAllTags1
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        let tagId: string | null = null;
        let isConnection = false;
        let targetIds: string[] = [];
        let description: string | null = null;
        
        //@parseAllTags1->parseAllTags1.1:Try 8 regex patterns
        //@parseAllTags1.1
        const stepMatch = line.match(/\/\/\s*@([\w.]+)->([\d.]+)>([\w.]+)(?::([^\n]+))?/);
        const sequenceDoubleMatch = line.match(/\/\/\s*@([\w.]+)->>([\w.]+)(?::([^\n]+))?/);
        const implicitDoubleMatch = line.match(/\/\/\s*@->>([\w.]+)(?::([^\n]+))?/);
        const explicitMatch = line.match(/\/\/\s*@([\w.]+)->([\w.]+)(?::([^\n]+))?/);
        const implicitMatch = line.match(/\/\/\s*@->([\w.]+)/);
        const classInlineMatch = line.match(/\/\/\s*@([\w.]+)(<\|--|--|\*--|o--|-->)([\w.]+)(?::([^\n]+))?/);
        const classMatch = line.match(/\/\/\s*@(<\|--|--|\*--|o--|-->)([\w.]+)/);
        const normalMatch = line.match(/\/\/\s*@([\w.]+)(?::([^\n]+))?/);
        
        //@parseAllTags1.1->parseAllTags1.2:Classify by match result
        //@parseAllTags1.2
        if (classInlineMatch) {
            tagId = `${classInlineMatch[1]}->${classInlineMatch[3]}`;
            isConnection = true;
            targetIds.push(classInlineMatch[3]);
            description = classInlineMatch[5] ? classInlineMatch[5].trim() : null;
        } else if (sequenceDoubleMatch) {
            tagId = `${sequenceDoubleMatch[1]}->${sequenceDoubleMatch[2]}`;
            isConnection = true;
            targetIds.push(sequenceDoubleMatch[2]);
            description = sequenceDoubleMatch[3] ? sequenceDoubleMatch[3].trim() : null;
        } else if (stepMatch) {
            tagId = `${stepMatch[1]}->${stepMatch[3]}`;
            isConnection = true;
            targetIds.push(stepMatch[3]);
            description = stepMatch[4] ? stepMatch[4].trim() : null;
        } else if (explicitMatch) {
            tagId = `${explicitMatch[1]}->${explicitMatch[2]}`;
            isConnection = true;
            targetIds.push(explicitMatch[2]);
            description = explicitMatch[3] ? explicitMatch[3].trim() : null;
        } else if (implicitDoubleMatch) {
            tagId = `->>${implicitDoubleMatch[1]}`;
            isConnection = true;
            targetIds.push(implicitDoubleMatch[1]);
            description = implicitDoubleMatch[2] ? implicitDoubleMatch[2].trim() : null;
        } else if (implicitMatch) {
            tagId = `->${implicitMatch[1]}`;
            isConnection = true;
            targetIds.push(implicitMatch[1]);
        } else if (classMatch) {
            tagId = classMatch[2];
            isConnection = true;
            targetIds.push(classMatch[2]);
        } else if (normalMatch) {
            tagId = normalMatch[1];
            isConnection = false;
            description = normalMatch[2] ? normalMatch[2].trim() : null;
        }
        
        if (!tagId) continue;
        if (tagId.startsWith('::')) continue;
        
        //@parseAllTags1.2->parseAllTags1.3:Append to tag array
        //@parseAllTags1.3
        const tagInfo: TagInfo = { id: tagId, line: i, isConnection, targetIds, description };
        allTags.push(tagInfo);
    }
    //@parseAllTags1.3->parseAllTags2:Return completed array
    //@parseAllTags2:Parsed tags ready
    return allTags;
}

/**
 * Counts elements (nodes and connections) in Mermaid code
 */
//@countDiagramElements
export function countDiagramElements(mermaidCode: string): { nodes: number; connections: number } {
    //@countDiagramElements1:Split sub-diagrams by separator line
    const subDiagrams = mermaidCode.split(/^---$/m).map(s => s.trim()).filter(s => s.length > 0);
    const uniqueNodes = new Set<string>();
    const uniqueConnections = new Set<string>();

    //@countDiagramElements1->countDiagramElements2:Scan each sub-diagram line by line
    //@countDiagramElements2:Sub-diagrams fully scanned
    for (const code of subDiagrams) {
        const diagramLines = code.split(/\r?\n/);
        for (const line of diagramLines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            //@countDiagramElements2->countDiagramElements2.1:Check for entity node patterns
            //@countDiagramElements2.1
            if (trimmed.startsWith('participant ')) { uniqueNodes.add(trimmed); continue; }
            if (/^class\s+\w+/.test(trimmed)) { uniqueNodes.add(trimmed); continue; }
            if (trimmed.startsWith('subgraph ')) { uniqueNodes.add(trimmed); continue; }
            if (/^state\s+\w+/.test(trimmed) && !trimmed.includes(':')) { uniqueNodes.add(trimmed); continue; }
            if (/^\w+\s*\{$/.test(trimmed)) { uniqueNodes.add(trimmed); continue; }
            
            //@countDiagramElements2->countDiagramElements2.2:Check for connection edge patterns
            //@countDiagramElements2.2
            if (/^\s*[\w.]+\s*->>/.test(trimmed)) { uniqueConnections.add(trimmed.replace(/:\s*\d+(\.\d+)?\s*/, ': ')); continue; }
            if (/^\s*[\w.]+\s*-->/.test(trimmed)) { uniqueConnections.add(trimmed); continue; }
            if (/^\s*[\w.]+\s+(--|<\|--|\*--|o--)\s+[\w.]+/.test(trimmed)) { uniqueConnections.add(trimmed); continue; }
            if (/^\s*[\w.]+\s+\|\|--/.test(trimmed)) { uniqueConnections.add(trimmed); continue; }
        }
    }
    //@countDiagramElements2->countDiagramElements3:Return counted totals
    //@countDiagramElements3:Node and connection counts returned
    return { nodes: uniqueNodes.size, connections: uniqueConnections.size };
}

/**
 * Checks for orphan tags (entry nodes without code below) and stacked tags.
 */
//@findOrphanTags
export function findOrphanTags(allTags: TagInfo[], lines: string[], diagramType?: string): string[] {
    const issues: string[] = [];
    const typeKey = (diagramType || '').toLowerCase().replace(/\s+/g, '');
    const skipStackingCheck = typeKey.startsWith('classdiagram') || typeKey.startsWith('erdiagram');

    //@findOrphanTags1:Iterate all tags and check placement
    for (const tag of allTags) {
        if (tag.isConnection) {
            let hasCodeBetween = false;
            for (let j = tag.line + 1; j < Math.min(tag.line + 3, lines.length); j++) {
                const nextLine = lines[j];
                if (nextLine.trim().length === 0) continue;
                if (nextLine.match(/\/\/\s*@/)) {
                    const nextTagMatch = nextLine.match(/\/\/\s*@([\w.]+)(?::([^\n]+))?/);
                    if (nextTagMatch) {
                        const nextTagId = nextTagMatch[1];
                        const isNextTagConnection = /->|-->|<\|--|--/.test(nextTagId);
                        if (isNextTagConnection) {
                            issues.push(`Tag ${tag.id} (line ${tag.line + 1}) is stacked with other tags - each tag must be directly above its own code line (1:1 ratio)`);
                            break;
                        }
                        hasCodeBetween = true;
                        break;
                    }
                }
                hasCodeBetween = true;
                break;
            }
            continue;
        }
        
        if (!/\d/.test(tag.id)) continue;

        if (skipStackingCheck) continue;
        
        //@findOrphanTags1->findOrphanTags2:Verify entry node has code below
        //@findOrphanTags2:Entry node verified (or flagged)
        let hasCode = false;
        for (let j = tag.line + 1; j < Math.min(tag.line + 3, lines.length); j++) {
            const nextLine = lines[j];
            if (nextLine.trim().length === 0) continue;
            if (nextLine.match(/\/\/\s*@/)) {
                issues.push(`Tag ${tag.id} (line ${tag.line + 1}) is stacked with other tags - each tag must be directly above its own code line (1:1 ratio)`);
                break;
            }
            hasCode = true;
            break;
        }
        
        if (!hasCode && !issues.some(i => i.includes(`line ${tag.line + 1}`))) {
            issues.push(`Tag ${tag.id} (line ${tag.line + 1}) has no code below it`);
        }
    }
    //@findOrphanTags2->findOrphanTags3:Return issue list
    //@findOrphanTags3:Issues collected
    return issues;
}

/**
 * Checks that tags are properly positioned directly above code, not separated by comments.
 */
//@findTagPlacementIssues
export function findTagPlacementIssues(allTags: TagInfo[], lines: string[], diagramType?: string): string[] {
    const issues: string[] = [];
    const typeKey = (diagramType || '').toLowerCase().replace(/\s+/g, '');
    const skipStackingCheck = typeKey.startsWith('classdiagram') || typeKey.startsWith('erdiagram');
    
    //@findTagPlacementIssues1:Scan each tag's next lines
    for (const tag of allTags) {
        if (tag.isConnection || !/\d/.test(tag.id)) continue;
        
        if (skipStackingCheck) continue;
        
        const checkRange = Math.min(tag.line + 3, lines.length);
        let foundCode = false;
        let foundCommentBetween = false;
        
        for (let j = tag.line + 1; j < checkRange; j++) {
            const nextLine = lines[j];
            const trimmed = nextLine.trim();
            
            if (trimmed.length === 0) continue;
            
            if (nextLine.match(/\/\/\s*@/)) {
                issues.push(`Tag ${tag.id} (line ${tag.line + 1}) is stacked with other tags - each tag must be directly above its own code line (1:1 ratio)`);
                break;
            }
            
            if (trimmed.startsWith('//') && !trimmed.match(/\/\/\s*@/)) {
                foundCommentBetween = true;
                continue;
            }
            
            if (!trimmed.startsWith('//')) {
                foundCode = true;
                if (foundCommentBetween) {
                    issues.push(`Tag ${tag.id} (line ${tag.line + 1}) has regular comments between tag and code (line ${j + 1})`);
                }
                break;
            }
        }
        
        if (!foundCode) {
            issues.push(`Tag ${tag.id} (line ${tag.line + 1}) has no code below it`);
        }
    }
    
    return issues;
}

/**
 * Checks for diagrams with nodes but no connections
 */
//@findMissingConnections
export function findMissingConnections(allTags: TagInfo[], diagramType: string): string[] {
    const issues: string[] = [];
    const typeKey = diagramType.toLowerCase().replace(/\s+/g, '');
    
    //@findMissingConnections1:Check if diagram type expects connections
    const shouldHaveConnections = 
        typeKey.startsWith('classdiagram') ||
        typeKey.startsWith('flowchart') ||
        typeKey.startsWith('graph') ||
        typeKey.startsWith('statediagram') ||
        typeKey.startsWith('erdiagram');
    
    if (!shouldHaveConnections) return issues;
    
    //@findMissingConnections1->findMissingConnections2:Count nodes vs connections
    //@findMissingConnections2:Nodes-and-connections count ready
    const nodes = allTags.filter(t => !t.isConnection && !/\d/.test(t.id));
    const connections = allTags.filter(t => t.isConnection);
    
    if (nodes.length > 0 && connections.length === 0) {
        issues.push(`Diagram has ${nodes.length} node(s) but no connections - did you forget to add relationship tags?`);
    }
    
    return issues;
}

/**
 * Checks that sequential/numbered nodes in process-oriented diagrams have at least one connection.
 * Flowcharts/graphs, sequence diagrams, and state diagrams represent flows where each numbered
 * step should be connected to something. Class and ER diagrams are exempt because standalone
 * classes/entities are valid.
 */
//@findSequentialNodesWithoutConnections
export function findSequentialNodesWithoutConnections(allTags: TagInfo[], diagramType: string): string[] {
    const issues: string[] = [];
    const typeKey = diagramType.toLowerCase().replace(/\s+/g, '');

    //@findSequentialNodesWithoutConnections1:Check if diagram type requires sequential node connectivity
    const shouldCheck =
        typeKey.startsWith('flowchart') ||
        typeKey.startsWith('graph') ||
        typeKey.startsWith('sequencediagram') ||
        typeKey.startsWith('statediagram') ||
        typeKey.includes('state');

    if (!shouldCheck) return issues;

    //@findSequentialNodesWithoutConnections1->findSequentialNodesWithoutConnections2:Collect all sequential (numbered) nodes
    //@findSequentialNodesWithoutConnections2:Sequential nodes collected
    const sequentialNodes = allTags.filter(t => !t.isConnection && /\d/.test(t.id));
    if (sequentialNodes.length === 0) return issues;

    //@findSequentialNodesWithoutConnections2->findSequentialNodesWithoutConnections3:Build set of connected node IDs
    //@findSequentialNodesWithoutConnections3:Connected set built
    const connectedIds = new Set<string>();

    for (const tag of allTags) {
        if (!tag.isConnection) continue;

        // Add all target IDs from connection tags
        for (const targetId of tag.targetIds) {
            connectedIds.add(targetId);
        }

        // Extract source from <source>-><target> connection IDs
        if (tag.id.includes('->')) {
            const [source] = tag.id.split('->');
            if (source) connectedIds.add(source.trim());
        }
    }

    //@findSequentialNodesWithoutConnections3->findSequentialNodesWithoutConnections4:Add sequence hierarchy parents (e.g., Entry1.1 implies Entry1 has an edge)
    //@findSequentialNodesWithoutConnections4:Sequence parents added
    for (const node of sequentialNodes) {
        if (!node.id.includes('.')) continue;
        const lastDot = node.id.lastIndexOf('.');
        const parentId = node.id.substring(0, lastDot);
        connectedIds.add(parentId);
    }

    //@findSequentialNodesWithoutConnections4->findSequentialNodesWithoutConnections5:Report nodes without connections
    //@findSequentialNodesWithoutConnections5:Issues returned
    for (const node of sequentialNodes) {
        if (!connectedIds.has(node.id)) {
            issues.push(`Node "${node.id}" (line ${node.line + 1}) has no connections — add a connection tag (e.g., //@->${node.id}) or reference it from another node`);
        }
    }

    return issues;
}

/**
 * Checks connections pointing to non-existent IDs.
 * Two-pass: first collect all valid IDs, then validate each connection target.
 */
//@findInvalidReferences
export function findInvalidReferences(allTags: TagInfo[]): string[] {
    const issues: string[] = [];
    const validIds = new Set(allTags.map(t => t.id));

    //@findInvalidReferences1:Collect valid IDs from all sources
    for (const tag of allTags) {
        if (tag.isConnection && tag.id.includes('->')) {
            const [source, target] = tag.id.split('->');
            if (source) validIds.add(source.trim());
            if (target) validIds.add(target.trim());
        }
    }

    //@findInvalidReferences1->findInvalidReferences2:Validate each connection target
    //@findInvalidReferences2:Target validation complete
    for (const tag of allTags) {
        if (!tag.isConnection) continue;
        for (const targetId of tag.targetIds) {
            if (!validIds.has(targetId)) {
                issues.push(`Connection ${tag.id} points to non-existent ID: ${targetId}`);
            }
        }
    }
    return issues;
}

// ── Diagram type-specific peer count validators ──

//@validateClassDiagramCounts
function validateClassDiagramCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    //@validateClassDiagramCounts1:Count expected nodes (groups only)
    const expectedNodes = allTags.filter(t => !t.isConnection && !/\d/.test(t.id)).length;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagram(${diagramNodes})`);
    }
    //@validateClassDiagramCounts1->validateClassDiagramCounts2:Count connections and compare
    //@validateClassDiagramCounts2:Connection count compared
    const connectionCount = allTags.filter(t => t.isConnection).length;
    if (connectionCount !== diagramConnections) {
        issues.push(`Connections(${connectionCount}) ≠ Diagram(${diagramConnections})`);
    }
    return issues;
}

//@validateSequenceDiagramCounts
function validateSequenceDiagramCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];

    const participants = new Set<string>();
    
    //@validateSequenceDiagramCounts1:Extract participants from entry nodes
    for (const tag of allTags) {
        if (!tag.isConnection && /^[a-zA-Z_]+\d+$/.test(tag.id)) {
            const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
            if (groupMatch) {
                participants.add(groupMatch[1]);
            }
        }
    }

    //@validateSequenceDiagramCounts1->validateSequenceDiagramCounts2:Extract participants from connections
    //@validateSequenceDiagramCounts2:All participants extracted
    for (const tag of allTags) {
        if (tag.isConnection && tag.id.includes('->')) {
            const [source, target] = tag.id.split('->');
            if (source) participants.add(source.trim());
            if (target) participants.add(target.trim());
        }
    }

    const expectedNodes = participants.size;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagram(${diagramNodes})`);
    }
    //@validateSequenceDiagramCounts2->validateSequenceDiagramCounts3:Dedup and count unique messages
    //@validateSequenceDiagramCounts3:Unique messages counted
    const uniqueMessages = new Set<string>();

    for (const tag of allTags) {
        if (tag.isConnection && tag.id.includes('->')) {
            const [source, target] = tag.id.split('->');
            if (source && target) {
                const label = tag.description || 'message';
                uniqueMessages.add(`${source.trim()}->>${target.trim()}:${label}`);
            }
        }
    }

    const expectedConnections = uniqueMessages.size;
    if (expectedConnections !== diagramConnections) {
        issues.push(`Connections(${expectedConnections}) ≠ Diagram(${diagramConnections})`);
    }
    return issues;
}

//@validateFlowchartCounts
function validateFlowchartCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    //@validateFlowchartCounts1:Count unique group nodes
    const groupNodes = allTags.filter(t => !t.isConnection && !/\d/.test(t.id));
    const seenIds = new Set<string>();
    const uniqueGroups = groupNodes.filter(t => {
        if (seenIds.has(t.id)) return false;
        seenIds.add(t.id);
        return true;
    });
    const expectedNodes = uniqueGroups.length;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagram(${diagramNodes})`);
    }
    
    //@validateFlowchartCounts1->validateFlowchartCounts2:Classify tags by type
    //@validateFlowchartCounts2:Tags classified
    const tagNodes = allTags.filter(t => !t.isConnection);
    const groups = tagNodes.filter(t => !/\d/.test(t.id));
    const numbered = tagNodes.filter(t => /\d/.test(t.id));
    const entryNodes = numbered.filter(t => /^[a-zA-Z]+[0-9]+$/.test(t.id));
    const sequenceNodes = numbered.filter(t => /\.[0-9]/.test(t.id));
    
    const edges = new Set<string>();
    
    //@validateFlowchartCounts2->validateFlowchartCounts3:Build ID-to-node map
    //@validateFlowchartCounts3:ID mapping built
    const idToNodeId = new Map<string, string>();
    for (const n of [...entryNodes, ...sequenceNodes]) {
        idToNodeId.set(n.id, n.id);
    }
    for (const group of groups) {
        const firstChild = [...entryNodes, ...sequenceNodes].find(n =>
            n.id.toLowerCase() === group.id.toLowerCase() || n.id.toLowerCase().startsWith(group.id.toLowerCase())
        );
        if (firstChild) {
            idToNodeId.set(group.id, idToNodeId.get(firstChild.id)!);
        }
    }
    
    //@validateFlowchartCounts3->validateFlowchartCounts4:Add sequence parent-child edges
    //@validateFlowchartCounts4:Sequence edges added
    for (const seq of sequenceNodes) {
        const lastDot = seq.id.lastIndexOf('.');
        if (lastDot > 0) {
            const parentId = seq.id.substring(0, lastDot);
            const parentNode = idToNodeId.get(parentId);
            const src = idToNodeId.get(seq.id);
            if (parentNode && src && parentNode !== src) {
                const key = `${parentNode}->${src}`;
                edges.add(key);
            }
        }
    }
    
    const connectionTags = allTags.filter(t => t.isConnection);

    //@validateFlowchartCounts4->validateFlowchartCounts5:Add explicit connection edges
    //@validateFlowchartCounts5:Explicit edges added
    for (const conn of connectionTags) {
        if (!conn.id.includes('->')) continue;

        const arrowIdx = conn.id.indexOf('->');
        const source = conn.id.substring(0, arrowIdx);
        const target = conn.id.substring(arrowIdx + 2);

        const sourceOk = source === '' || idToNodeId.has(source);
        const targetOk = idToNodeId.has(target);

        if (sourceOk && targetOk) {
            const key = conn.id + (conn.description ? ':' + conn.description : '');
            edges.add(key);
        }
    }
    
    //@validateFlowchartCounts5->validateFlowchartCounts6:Compare edge counts
    //@validateFlowchartCounts6:Edge count compared
    const expectedConnections = edges.size;
    if (expectedConnections !== diagramConnections) {
        issues.push(`Connections(${expectedConnections}) ≠ Diagram(${diagramConnections})`);
    }
    
    return issues;
}

//@validateStateDiagramCounts
function validateStateDiagramCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    //@validateStateDiagramCounts1:Count expected nodes
    const expectedNodes = allTags.filter(t => !t.isConnection && !/\d/.test(t.id)).length;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagram(${diagramNodes})`);
    }
    //@validateStateDiagramCounts1->validateStateDiagramCounts2:Count unique connections (dedupe by source->target)
    //@validateStateDiagramCounts2:Unique connection count compared
    const uniqueConnectionKeys = new Set<string>();
    for (const tag of allTags) {
        if (tag.isConnection && tag.id.includes('->')) {
            uniqueConnectionKeys.add(tag.id);
        }
    }
    const connectionCount = uniqueConnectionKeys.size;
    if (connectionCount !== diagramConnections) {
        issues.push(`Connections(${connectionCount}) ≠ Diagram(${diagramConnections})`);
    }
    return issues;
}

//@validateERDiagramCounts
function validateERDiagramCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    //@validateERDiagramCounts1:Count expected nodes
    const expectedNodes = allTags.filter(t => !t.isConnection).length;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagram(${diagramNodes})`);
    }
    //@validateERDiagramCounts1->validateERDiagramCounts2:Count connections and compare
    //@validateERDiagramCounts2:Connection count compared
    const connectionCount = allTags.filter(t => t.isConnection).length;
    if (connectionCount !== diagramConnections) {
        issues.push(`Connections(${connectionCount}) ≠ Diagram(${diagramConnections})`);
    }
    return issues;
}

/**
 * ORCHESTRATOR: validates if the generated diagram has the same number of elements as the MAD tags.
 * Pipeline: count diagram elements → parse all tags → dispatch to type-specific validator →
 * run tagging hygiene checks (orphan, placement, invalid refs, missing connections).
 */
//@validateDiagramCounts
export function validateDiagramCounts(
    documentText: string,
    mermaidCode: string,
    diagramType: string
): string[] {
    const lines = documentText.split(/\r?\n/);

    //@validateDiagramCounts1:Count node and connection totals in generated Mermaid
    const { nodes: diagramNodes, connections: diagramConnections } = countDiagramElements(mermaidCode);
    
    const issues: string[] = [];
    const typeKey = diagramType.toLowerCase().replace(/\s+/g, '');
    
    //@validateDiagramCounts1->validateDiagramCounts2:Dispatch to per-type peer validator
    //@validateDiagramCounts2:Type-specific peer check dispatched
    if (typeKey.startsWith('sequencediagram')) {
        const allTags = parseAllTags(documentText, lines);
        //@validateDiagramCounts2->validateSequenceDiagramCounts:Run sequence peer check
        issues.push(...validateSequenceDiagramCounts(allTags, diagramNodes, diagramConnections));
    } else {
        const allTags = parseAllTags(documentText, lines);
        if (typeKey.startsWith('classdiagram')) {
            //@validateDiagramCounts2->validateClassDiagramCounts:Run class peer check
            issues.push(...validateClassDiagramCounts(allTags, diagramNodes, diagramConnections));
        } else if (typeKey.startsWith('flowchart') || typeKey.startsWith('graph')) {
            //@validateDiagramCounts2->validateFlowchartCounts:Run flowchart peer check
            issues.push(...validateFlowchartCounts(allTags, diagramNodes, diagramConnections));
        } else if (typeKey.startsWith('statediagram') || typeKey.includes('state')) {
            //@validateDiagramCounts2->validateStateDiagramCounts:Run state peer check
            issues.push(...validateStateDiagramCounts(allTags, diagramNodes, diagramConnections));
        } else if (typeKey.startsWith('erdiagram')) {
            //@validateDiagramCounts2->validateERDiagramCounts:Run ER peer check
            issues.push(...validateERDiagramCounts(allTags, diagramNodes, diagramConnections));
        }
    }
    
    //@validateDiagramCounts2->validateDiagramCounts3:Run tag hygiene checks
    //@validateDiagramCounts3:Hygiene checks complete
    const allTags = parseAllTags(documentText, lines);
    issues.push(...findOrphanTags(allTags, lines, diagramType));
    issues.push(...findInvalidReferences(allTags));
    issues.push(...findTagPlacementIssues(allTags, lines, diagramType));
    issues.push(...findMissingConnections(allTags, diagramType));
    issues.push(...findSequentialNodesWithoutConnections(allTags, diagramType));
    
    //@validateDiagramCounts3->validateDiagramCounts4:Return all issues
    //@validateDiagramCounts4:Issues returned
    return issues;
}

/**
 * Validates the Mermaid syntax using the real Mermaid parser (mermaid.parse).
 */
//@validateMermaidForType
export function validateMermaidForType(mermaidCode: string, _diagramType: string): { valid: boolean; error?: string } {
    return validateMermaidSyntax(mermaidCode);
}