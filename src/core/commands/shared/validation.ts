import { filterAllNodes } from '../../diagram/parser';
import { validateDiagram, ValidationResult } from '../../diagram/validator';
import { validateMermaidSyntax } from '../../diagram/mermaid-validator';

export type { ValidationResult } from '../../diagram/validator';

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
export function validateMADStructure(document: import('vscode').TextDocument, prefix: string): ValidationResult {
    const allNodes = filterAllNodes(document);
    return validateDiagram(allNodes, prefix);
}

/**
 * Parses all MAD tags from text
 */
export function parseAllTags(text: string, lines: string[]): TagInfo[] {
    const allTags: TagInfo[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        let tagId: string | null = null;
        let isConnection = false;
        let targetIds: string[] = [];
        let description: string | null = null;
        
        // IMPORTANT: Check all connection patterns BEFORE the generic normalMatch.
        // The normalMatch `//@ID` is greedy and will match the source portion of
        // inline connections like `//@Client->Server` (capturing just `Client`),
        // preventing the connection patterns from ever being evaluated.
        
        // Step-number arrow (e.g. //@Provider->1>Provider:Validate input or //@Provider->1.1>Provider:Label)
        // IMPORTANT: must be checked BEFORE explicitMatch, otherwise the generic
        // "//@Source->Target" regex greedily (mis)matches the step number as the target ID.
        const stepMatch = line.match(/\/\/\s*@([\w.]+)->([\d.]+)>([\w.]+)(?::([^\n]+))?/);
        const sequenceDoubleMatch = line.match(/\/\/\s*@([\w.]+)->>([\w.]+)(?::([^\n]+))?/);
        // Sequence implicit reverse: //@->>Target (double-arrow version of implicit)
        const implicitDoubleMatch = line.match(/\/\/\s*@->>([\w.]+)(?::([^\n]+))?/);
        const explicitMatch = line.match(/\/\/\s*@([\w.]+)->([\w.]+)(?::([^\n]+))?/);
        const implicitMatch = line.match(/\/\/\s*@->([\w.]+)/);
        const classInlineMatch = line.match(/\/\/\s*@([\w.]+)(<\|--|--|\*--|o--|-->)([\w.]+)(?::([^\n]+))?/);
        const classMatch = line.match(/\/\/\s*@(<\|--|--|\*--|o--|-->)([\w.]+)/);
        // Generic normal node: //@ID:comment (MUST be checked LAST)
        const normalMatch = line.match(/\/\/\s*@([\w.]+)(?::([^\n]+))?/);
        
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
            // //@->>Target (sequence double-arrow implicit reverse)
            tagId = `->>${implicitDoubleMatch[1]}`;
            isConnection = true;
            targetIds.push(implicitDoubleMatch[1]);
            description = implicitDoubleMatch[2] ? implicitDoubleMatch[2].trim() : null;
        } else if (implicitMatch) {
            // //@->Target (implicit reverse)
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
        
        const tagInfo: TagInfo = { id: tagId, line: i, isConnection, targetIds, description };
        allTags.push(tagInfo);
    }
    return allTags;
}

/**
 * Counts elements (nodes and connections) in Mermaid code
 */
export function countDiagramElements(mermaidCode: string): { nodes: number; connections: number } {
    // Split on --- to handle multi-diagram output (e.g. sequence diagrams per function)
    // Deduplicate participants and connections that repeat across sub-diagrams
    const subDiagrams = mermaidCode.split(/^---$/m).map(s => s.trim()).filter(s => s.length > 0);
    const uniqueNodes = new Set<string>();
    const uniqueConnections = new Set<string>();

    for (const code of subDiagrams) {
        const diagramLines = code.split(/\r?\n/);
        for (const line of diagramLines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // Nodes — deduplicate by name
            if (trimmed.startsWith('participant ')) { 
                uniqueNodes.add(trimmed); 
                continue; 
            }
            if (/^class\s+\w+/.test(trimmed)) { uniqueNodes.add(trimmed); continue; }
            if (trimmed.startsWith('subgraph ')) { uniqueNodes.add(trimmed); continue; }
            if (/^state\s+\w+/.test(trimmed) && !trimmed.includes(':')) { uniqueNodes.add(trimmed); continue; }
            if (/^\w+\s*\{$/.test(trimmed)) { uniqueNodes.add(trimmed); continue; }
            
            // Connections — deduplicate by full line content (excludes step label differences in multi-diagram mode)
            // Sequence: Client->>Server: message
            if (/^\s*[\w.]+\s*->>/.test(trimmed)) { 
                // Strip step number prefix (e.g. "1 ", "1.1 ") to deduplicate identical messages across diagrams
                const deduped = trimmed.replace(/->>\s*[\w.]+:\s*\d+(\.\d+)?\s*/, '->>$&'.replace(/.*?([\w.]+->>[\w.]+):.*/, '$1:'));
                uniqueConnections.add(trimmed.replace(/:\s*\d+(\.\d+)?\s*/, ': ')); 
                continue; 
            }
            // State/Flowchart: State1 --> State2 : label
            if (/^\s*[\w.]+\s*-->/.test(trimmed)) { uniqueConnections.add(trimmed); continue; }
            // Class: User -- Address : has
            if (/^\s*[\w.]+\s+(--|<\|--|\*--|o--)\s+[\w.]+/.test(trimmed)) { uniqueConnections.add(trimmed); continue; }
            // ER: User ||--o{ Address
            if (/^\s*[\w.]+\s+\|\|--/.test(trimmed)) { uniqueConnections.add(trimmed); continue; }
        }
    }
    return { nodes: uniqueNodes.size, connections: uniqueConnections.size };
}

/**
 * Checks for orphan tags (entry nodes without code below)
 */
export function findOrphanTags(allTags: TagInfo[], lines: string[], diagramType?: string): string[] {
    const issues: string[] = [];
    const typeKey = (diagramType || '').toLowerCase().replace(/\s+/g, '');
    // For classDiagram and erDiagram, stacked tags are the normal pattern —
    // multiple MAD tags collectively describe a single entity before the code.
    const skipStackingCheck = typeKey.startsWith('classdiagram') || typeKey.startsWith('erdiagram');

    for (const tag of allTags) {
        // Check both entry nodes and connection tags for stacking
        if (tag.isConnection) {
            // For connection tags, check if they're stacked (another connection tag immediately after)
            let hasCodeBetween = false;
            for (let j = tag.line + 1; j < Math.min(tag.line + 3, lines.length); j++) {
                const nextLine = lines[j];
                // Skip empty lines
                if (nextLine.trim().length === 0) continue;
                // If we find another MAD tag, check if it's also a connection (stacked) or a class declaration (valid)
                if (nextLine.match(/\/\/\s*@/)) {
                    // Check if the next tag is also a connection tag (invalid stacking)
                    const nextTagMatch = nextLine.match(/\/\/\s*@([\w.]+)(?::([^\n]+))?/);
                    if (nextTagMatch) {
                        const nextTagId = nextTagMatch[1];
                        // Check if this looks like a connection tag (contains -> or --> or <|-- or --)
                        const isNextTagConnection = /->|-->|<\|--|--/.test(nextTagId);
                        if (isNextTagConnection) {
                            issues.push(`Tag ${tag.id} (line ${tag.line + 1}) is stacked with other tags - each tag must be directly above its own code line (1:1 ratio)`);
                            break;
                        }
                        // Otherwise it's a class/node declaration, which is valid
                        hasCodeBetween = true;
                        break;
                    }
                }
                // Found actual code
                hasCodeBetween = true;
                break;
            }
            continue;
        }
        
        if (!/\d/.test(tag.id)) continue;

        // For classDiagram and erDiagram, stacked tags are the normal, expected pattern.
        // Multiple tags (members, relationships) are placed above a single code block.
        if (skipStackingCheck) continue;
        
        let hasCode = false;
        for (let j = tag.line + 1; j < Math.min(tag.line + 3, lines.length); j++) {
            const nextLine = lines[j];
            // Skip empty lines
            if (nextLine.trim().length === 0) continue;
            // MAD tags must have code directly below (1:1 ratio) - no stacking allowed
            if (nextLine.match(/\/\/\s*@/)) {
                issues.push(`Tag ${tag.id} (line ${tag.line + 1}) is stacked with other tags - each tag must be directly above its own code line (1:1 ratio)`);
                break;
            }
            // Found actual code
            hasCode = true;
            break;
        }
        
        if (!hasCode && !issues.some(i => i.includes(`line ${tag.line + 1}`))) {
            issues.push(`Tag ${tag.id} (line ${tag.line + 1}) has no code below it`);
        }
    }
    return issues;
}

/**
 * Checks that tags are properly positioned directly above code, not separated by comments.
 * A tag should be followed by code (or another tag), not by blank lines or regular comments.
 */
export function findTagPlacementIssues(allTags: TagInfo[], lines: string[], diagramType?: string): string[] {
    const issues: string[] = [];
    const typeKey = (diagramType || '').toLowerCase().replace(/\s+/g, '');
    // For classDiagram and erDiagram, stacked tags are the normal pattern —
    // multiple MAD tags collectively describe a single entity before the code.
    const skipStackingCheck = typeKey.startsWith('classdiagram') || typeKey.startsWith('erdiagram');
    
    for (const tag of allTags) {
        // Only check numbered entry nodes (Provider1, Provider1.1, etc.)
        if (tag.isConnection || !/\d/.test(tag.id)) continue;
        
        // For classDiagram and erDiagram, stacked tags are the normal, expected pattern.
        if (skipStackingCheck) continue;
        
        // Look at the next few lines after the tag
        const checkRange = Math.min(tag.line + 3, lines.length);
        let foundCode = false;
        let foundCommentBetween = false;
        
        for (let j = tag.line + 1; j < checkRange; j++) {
            const nextLine = lines[j];
            const trimmed = nextLine.trim();
            
            // Skip empty lines
            if (trimmed.length === 0) continue;
            
            // MAD tags must have code directly below (1:1 ratio) - no stacking allowed
            if (nextLine.match(/\/\/\s*@/)) {
                issues.push(`Tag ${tag.id} (line ${tag.line + 1}) is stacked with other tags - each tag must be directly above its own code line (1:1 ratio)`);
                break;
            }
            
            // Found a regular comment line (// but not //@ or // @)
            if (trimmed.startsWith('//') && !trimmed.match(/\/\/\s*@/)) {
                foundCommentBetween = true;
                continue; // Keep checking for code
            }
            
            // Found actual code
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
export function findMissingConnections(allTags: TagInfo[], diagramType: string): string[] {
    const issues: string[] = [];
    const typeKey = diagramType.toLowerCase().replace(/\s+/g, '');
    
    // Only check diagram types that should have connections
    const shouldHaveConnections = 
        typeKey.startsWith('classdiagram') ||
        typeKey.startsWith('flowchart') ||
        typeKey.startsWith('graph') ||
        typeKey.startsWith('statediagram') ||
        typeKey.startsWith('erdiagram');
    
    if (!shouldHaveConnections) return issues;
    
    // Count nodes and connections
    const nodes = allTags.filter(t => !t.isConnection && !/\d/.test(t.id));
    const connections = allTags.filter(t => t.isConnection);
    
    // If there are nodes but no connections, warn the user
    if (nodes.length > 0 && connections.length === 0) {
        issues.push(`Diagram has ${nodes.length} node(s) but no connections - did you forget to add relationship tags?`);
    }
    
    return issues;
}

/**
 * Checks connections pointing to non-existent IDs
 */
export function findInvalidReferences(allTags: TagInfo[]): string[] {
    const issues: string[] = [];
    const validIds = new Set(allTags.map(t => t.id));

    // Additionally, any identifier that appears as a source or target in a direct
    // connection (//@Source->Target or //@Source->N>Target) is implicitly valid —
    // the generator auto-adds these as participants without needing a //@ tag.
    for (const tag of allTags) {
        if (tag.isConnection && tag.id.includes('->')) {
            const [source, target] = tag.id.split('->');
            if (source) validIds.add(source.trim());
            if (target) validIds.add(target.trim());
        }
    }

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

// ── Diagram type-specific validations ──

function validateClassDiagramCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    const expectedNodes = allTags.filter(t => !t.isConnection && !/\d/.test(t.id)).length;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagram(${diagramNodes})`);
    }
    const connectionCount = allTags.filter(t => t.isConnection).length;
    if (connectionCount !== diagramConnections) {
        issues.push(`Connections(${connectionCount}) ≠ Diagram(${diagramConnections})`);
    }
    return issues;
}

function validateSequenceDiagramCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];

    // Collect participants the SAME way the sequence generator does:
    // 1. For each numbered entry node (e.g. Handler1, Handler2), add its group ID (e.g. Handler)
    // 2. For each connection, add both source and target
    // This mirrors the generator's logic: it only renders participants that are
    // reachable via connections or serve as a method participant group.
    const participants = new Set<string>();
    
    // First: groups from numbered entry nodes match the generator
    for (const tag of allTags) {
        if (!tag.isConnection && /^[a-zA-Z_]+\d+$/.test(tag.id)) {
            const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
            if (groupMatch) {
                participants.add(groupMatch[1]);
            }
        }
    }

    // Second: all sources and targets from connections
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
    // The sequence generator produces messages only from direct connection tags
    // (//@Source->Target:label, //@Source->>Target:label, //@Source->N>Target:label).
    // Self-messages from entry nodes are no longer generated (functions are split
    // into independent sub-diagrams via ---).
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

function validateFlowchartCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    // Deduplicate groups by ID (matching filterAndSortNodes behavior in helpers.ts)
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
    
    // Simulates what the generator does to count expected connections
    const tagNodes = allTags.filter(t => !t.isConnection);
    const groups = tagNodes.filter(t => !/\d/.test(t.id));
    const numbered = tagNodes.filter(t => /\d/.test(t.id));
    const entryNodes = numbered.filter(t => /^[a-zA-Z]+[0-9]+$/.test(t.id));
    const sequenceNodes = numbered.filter(t => /\.[0-9]/.test(t.id));
    
    // Counts unique connections that the generator will create
    const edges = new Set<string>();
    
    // 1. Implicit connections from sequence nodes (lines 97-109 of the generator)
    // Replicate the generator's idToNodeId resolution:
    // - Every numbered node maps to itself
    // - Groups map to their first child (same as generator line 72)
    const idToNodeId = new Map<string, string>();
    for (const n of [...entryNodes, ...sequenceNodes]) {
        idToNodeId.set(n.id, n.id);
    }
    for (const group of groups) {
        // Find first child: an entry or sequence node starting with group.id
        const firstChild = [...entryNodes, ...sequenceNodes].find(n =>
            n.id.toLowerCase() === group.id.toLowerCase() || n.id.toLowerCase().startsWith(group.id.toLowerCase())
        );
        if (firstChild) {
            idToNodeId.set(group.id, idToNodeId.get(firstChild.id)!);
        }
    }
    
    for (const seq of sequenceNodes) {
        const lastDot = seq.id.lastIndexOf('.');
        if (lastDot > 0) {
            const parentId = seq.id.substring(0, lastDot);
            const parentNode = idToNodeId.get(parentId);
            const src = idToNodeId.get(seq.id);
            // Replicate generator's self-reference check (parentNode !== src)
            if (parentNode && src && parentNode !== src) {
                const key = `${parentNode}->${src}`;
                edges.add(key);
            }
        }
    }
    
    // 2. Explicit connections from tags (lines 111-120 of the generator)
    // In flowchart, connections are tags of type //@->Target or //@Source->Target.
    // Only count connections where both source (if present) and target exist as
    // known nodes, matching the generator's behaviour — it skips edges whose
    // endpoints are not in idToNodeId.
    const connectionTags = allTags.filter(t => t.isConnection);
    // Build the set of known node IDs: groups AND all numbered nodes.
    // The generator maps groups to their first child node, so groups are valid
    // sources / targets as well.
    const allKnownNodeIds = new Set<string>();
    for (const group of groups) allKnownNodeIds.add(group.id);
    for (const n of numbered) allKnownNodeIds.add(n.id);

    for (const conn of connectionTags) {
        if (!conn.id.includes('->')) continue;

        const arrowIdx = conn.id.indexOf('->');
        const source = conn.id.substring(0, arrowIdx);
        const target = conn.id.substring(arrowIdx + 2);

        // Source must be a known node (or empty for implicit //@->Target tags).
        // For implicit tags the generator resolves the source via
        // findRetroNodeForLine — we can't fully replicate that here, so we
        // accept empty sources and let the target check guard correctness.
        const sourceOk = source === '' || allKnownNodeIds.has(source);
        const targetOk = allKnownNodeIds.has(target);

        if (sourceOk && targetOk) {
            // Include label in the dedup key — the generator uses
            // `${from}->${to}:${label}` as its dedup key, so multiple
            // connections between same source/target with different
            // labels produce distinct edges (e.g. self-connections
            // //@Screen2->Screen2:Submit and //@Screen2->Screen2:Capture).
            const key = conn.id + (conn.description ? ':' + conn.description : '');
            edges.add(key);
        }
    }
    
    const expectedConnections = edges.size;
    if (expectedConnections !== diagramConnections) {
        issues.push(`Connections(${expectedConnections}) ≠ Diagram(${diagramConnections})`);
    }
    
    return issues;
}

function validateStateDiagramCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    const expectedNodes = allTags.filter(t => !t.isConnection && !/\d/.test(t.id)).length;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagram(${diagramNodes})`);
    }
    const connectionCount = allTags.filter(t => t.isConnection).length;
    if (connectionCount !== diagramConnections) {
        issues.push(`Connections(${connectionCount}) ≠ Diagram(${diagramConnections})`);
    }
    return issues;
}

function validateERDiagramCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    const expectedNodes = allTags.filter(t => !t.isConnection).length;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagram(${diagramNodes})`);
    }
    const connectionCount = allTags.filter(t => t.isConnection).length;
    if (connectionCount !== diagramConnections) {
        issues.push(`Connections(${connectionCount}) ≠ Diagram(${diagramConnections})`);
    }
    return issues;
}

/**
 * Validates if the generated diagram has the same number of elements as the MAD tags
 * Returns array of issues (empty = all ok)
 */
export function validateDiagramCounts(
    documentText: string,
    mermaidCode: string,
    diagramType: string
): string[] {
    const lines = documentText.split(/\r?\n/);
    const { nodes: diagramNodes, connections: diagramConnections } = countDiagramElements(mermaidCode);
    
    const issues: string[] = [];
    const typeKey = diagramType.toLowerCase().replace(/\s+/g, '');
    
    if (typeKey.startsWith('sequencediagram')) {
        const allTags = parseAllTags(documentText, lines);
        issues.push(...validateSequenceDiagramCounts(allTags, diagramNodes, diagramConnections));
    } else {
        const allTags = parseAllTags(documentText, lines);
        if (typeKey.startsWith('classdiagram')) {
            issues.push(...validateClassDiagramCounts(allTags, diagramNodes, diagramConnections));
        } else if (typeKey.startsWith('flowchart') || typeKey.startsWith('graph')) {
            issues.push(...validateFlowchartCounts(allTags, diagramNodes, diagramConnections));
        } else if (typeKey.startsWith('statediagram') || typeKey.includes('state')) {
            issues.push(...validateStateDiagramCounts(allTags, diagramNodes, diagramConnections));
        } else if (typeKey.startsWith('erdiagram')) {
            issues.push(...validateERDiagramCounts(allTags, diagramNodes, diagramConnections));
        }
    }
    
    // Orphan and reference checks still use raw tags
    const allTags = parseAllTags(documentText, lines);
    issues.push(...findOrphanTags(allTags, lines, diagramType));
    issues.push(...findInvalidReferences(allTags));
    issues.push(...findTagPlacementIssues(allTags, lines, diagramType));
    issues.push(...findMissingConnections(allTags, diagramType));
    
    return issues;
}

/**
 * Validates the Mermaid syntax using the real Mermaid parser (mermaid.parse).
 * Replaces the old regex-based type-specific validators with accurate,
 * grammar-level validation that catches invalid node IDs, malformed syntax,
 * and other errors the regex checks missed.
 */
export function validateMermaidForType(mermaidCode: string, _diagramType: string): { valid: boolean; error?: string } {
    return validateMermaidSyntax(mermaidCode);
}