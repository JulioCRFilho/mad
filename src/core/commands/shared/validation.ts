import { filterAllNodes } from '../../diagram/parser';
import { validateDiagram, ValidationResult } from '../../diagram/validator';
import { findRelatedTags } from './helpers';
import { ProcessedNode } from '../../diagram/parser';

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
        
        const normalMatch = line.match(/\/\/@([\w.]+)(?::([^\n]+))?/);
        const implicitMatch = line.match(/\/\/@->([\w.]+)/);
        const explicitMatch = line.match(/\/\/@([\w.]+)->([\w.]+)(?::([^\n]+))?/);
        const sequenceDoubleMatch = line.match(/\/\/@([\w.]+)->>([\w.]+)(?::([^\n]+))?/);
        const classMatch = line.match(/\/\/@(<\|--|--|\*--|o--|-->)([\w.]+)/);
        const classInlineMatch = line.match(/\/\/@([\w.]+)(<\|--|--|\*--|o--|-->)([\w.]+)(?::([^\n]+))?/);
        
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
        } else if (explicitMatch) {
            tagId = `${explicitMatch[1]}->${explicitMatch[2]}`;
            isConnection = true;
            targetIds.push(explicitMatch[2]);
            description = explicitMatch[3] ? explicitMatch[3].trim() : null;
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
        
        const tagInfo: TagInfo = { id: tagId, line: i, isConnection, targetIds, description };
        allTags.push(tagInfo);
    }
    return allTags;
}

/**
 * Counts elements (nodes and connections) in Mermaid code
 */
export function countDiagramElements(mermaidCode: string): { nodes: number; connections: number } {
    let nodes = 0;
    let connections = 0;
    const diagramLines = mermaidCode.split(/\r?\n/);
    for (const line of diagramLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Nodes
        if (trimmed.startsWith('participant ')) { nodes++; continue; }
        if (/^class\s+\w+/.test(trimmed)) { nodes++; continue; }
        if (trimmed.startsWith('subgraph ')) { nodes++; continue; }
        if (/^state\s+\w+/.test(trimmed) && !trimmed.includes(':')) { nodes++; continue; }
        if (/^\w+\s*\{$/.test(trimmed)) { nodes++; continue; }
        
        // Connections - checks specific patterns
        // Sequence: Client->>Server: message (participant ->>
        if (/^\s*\w+\s*->>/.test(trimmed)) { connections++; continue; }
        // State/Flowchart: State1 --> State2 : label (palavra -->)
        if (/^\s*\w+\s*-->/.test(trimmed)) { connections++; continue; }
        // Class: User -- Address : has (palavra -- ou <|--)
        if (/^\s*\w+\s+(--|<\|--|\*--|o--)\s+\w+/.test(trimmed)) { connections++; continue; }
        // ER: User ||--o{ Address (palavra ||--)
        if (/^\s*\w+\s+\|\|--/.test(trimmed)) { connections++; continue; }
    }
    return { nodes, connections };
}

/**
 * Checks for orphan tags (entry nodes without code below)
 */
export function findOrphanTags(allTags: TagInfo[], lines: string[]): string[] {
    const issues: string[] = [];
    for (const tag of allTags) {
        if (tag.isConnection) continue;
        if (!/\d/.test(tag.id)) continue;
        
        let hasCode = false;
        for (let j = tag.line + 1; j < Math.min(tag.line + 5, lines.length); j++) {
            const nextLine = lines[j];
            if (nextLine.match(/\/\/@/)) continue;
            if (nextLine.trim().length > 0) {
                hasCode = true;
                break;
            }
        }
        
        if (!hasCode) {
            issues.push(`Orphan tag: ${tag.id} (line ${tag.line + 1})`);
        }
    }
    return issues;
}

/**
 * Checks connections pointing to non-existent IDs
 */
export function findInvalidReferences(allTags: TagInfo[]): string[] {
    const issues: string[] = [];
    const validIds = new Set(allTags.map(t => t.id));
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

function validateSequenceDiagramCounts(nodes: ProcessedNode[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    const expectedNodes = nodes.filter(t => !/\d/.test(t.id) && !t.id.includes('->')).length;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagram(${diagramNodes})`);
    }
    // In sequenceDiagram, the generator produces messages from 3 sources:
    // 1. Direct connections: //@Source->Target:label
    // 2. Entry nodes as self-messages: //@Group1:label → Group->>Group:label
    // 3. Retro nodes with connections (forward pointers): //@Group1:label + //@->Target
    // The generator deduplicates messages with identical (from, to, label) triples,
    // so we must count unique triples to match what Mermaid actually renders.
    const uniqueMessages = new Set<string>();

    // 1. Direct connections: //@Source->>Target:label or //@Source->Target:label
    for (const node of nodes) {
        if (node.id.includes('->')) {
            const [source, target] = node.id.split('->');
            if (source && target) {
                const label = node.description || node.label || 'message';
                uniqueMessages.add(`${source.trim()}->>${target.trim()}:${label}`);
            }
        }
    }

    // 2. Entry nodes become self-messages from their parent group
    //    Ex: //@UploadDocument1:Build multipart body → UploadDocument->>UploadDocument: Build multipart body
    for (const node of nodes) {
        if (/\d/.test(node.id) && /^[a-zA-Z_]+[0-9]+$/.test(node.id)) {
            const groupMatch = node.id.match(/^([a-zA-Z_]+)\d+/);
            if (groupMatch) {
                const groupId = groupMatch[1];
                const label = node.label || node.description || node.id;
                uniqueMessages.add(`${groupId}->>${groupId}:${label}`);
            }
        }
    }

    // 3. Retro nodes with connections (forward pointers attached to entry nodes)
    //    Ex: //@Provider1:GetClient with connections: [{id: "Database", label: "GetClient"}]
    //    → Provider->>Database: GetClient
    for (const node of nodes) {
        if (node.connections && node.connections.length > 0) {
            const groupMatch = node.id.match(/^([a-zA-Z_]+)/);
            if (groupMatch) {
                const groupId = groupMatch[1];
                for (const conn of node.connections) {
                    const label = conn.label || node.label || node.id;
                    uniqueMessages.add(`${groupId}->>${conn.id}:${label}`);
                }
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
    const expectedNodes = allTags.filter(t => !t.isConnection && !/\d/.test(t.id)).length;
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
    for (const seq of sequenceNodes) {
        const lastDot = seq.id.lastIndexOf('.');
        if (lastDot > 0) {
            const parentId = seq.id.substring(0, lastDot);
            // Check if parentId exists as a group or node
            const parentExists = groups.some(g => g.id === parentId) || 
                                numbered.some(n => n.id === parentId);
            if (parentExists) {
                const key = `${parentId}->${seq.id}`;
                edges.add(key);
            }
        }
    }
    
    // 2. Explicit connections from tags (lines 111-120 of the generator)
    // In flowchart, connections are tags of type //@->Target or //@Source->Target
    const connectionTags = allTags.filter(t => t.isConnection);
    for (const conn of connectionTags) {
        // Extract source and target from tag
        // Format: "Source->Target" or "->Target"
        if (conn.id.includes('->')) {
            const key = conn.id;
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
        // For sequence diagrams, use findRelatedTags to get processed nodes with connections
        // This is necessary because the generator's processForwardPointers attaches forward
        // pointers to entry nodes, and we need to count those as messages too
        const mockDoc = {
            getText: () => documentText,
            lineCount: lines.length,
            lineAt: (n: number) => ({ text: lines[n] || '', lineNumber: n })
        } as any;
        const processedNodes = findRelatedTags(mockDoc, '', diagramType);
        issues.push(...validateSequenceDiagramCounts(processedNodes, diagramNodes, diagramConnections));
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
    issues.push(...findOrphanTags(allTags, lines));
    issues.push(...findInvalidReferences(allTags));
    
    return issues;
}

/**
 * Basic Mermaid syntax validation for Flowchart/Graph
 */
function validateFlowchartSyntax(lines: string[]): { valid: boolean; error?: string } {
    const hasNodes = lines.some(l => /^\s*[A-Za-z0-9_]+\[/.test(l));
    const hasConnections = lines.some(l => /-->/.test(l) || /---/.test(l) || /==>/.test(l));

    if (!hasNodes && !hasConnections) {
        return {
            valid: false,
            error: 'No nodes or connections found. Check if the tags are correct.'
        };
    }

    const ids = new Set<string>();
    const idRegex = /^([A-Za-z0-9_]+)\[/;
    for (const line of lines) {
        const match = line.match(idRegex);
        if (match) {
            const id = match[1];
            if (ids.has(id)) return { valid: false, error: `Duplicate ID: "${id}".` };
            ids.add(id);
        }
    }

    return { valid: true };
}

/**
 * Mermaid syntax validation for Sequence Diagram
 */
function validateSequenceSyntax(lines: string[]): { valid: boolean; error?: string } {
    const hasParticipants = lines.some(l => l.trim().startsWith('participant'));
    const hasMessages = lines.some(l => l.includes('->>'));
    if (!hasParticipants && !hasMessages) {
        return {
            valid: false,
            error: 'No participants or messages found. Check the tags.'
        };
    }
    return { valid: true };
}

/**
 * Mermaid syntax validation for Class Diagram
 */
function validateClassSyntax(lines: string[]): { valid: boolean; error?: string } {
    const hasClasses = lines.some(l => l.trim().startsWith('class'));
    if (!hasClasses) {
        return {
            valid: false,
            error: 'No classes found. Check the tags.'
        };
    }
    
    // Check for empty class definitions (classes with no methods)
    // Handles both single-line: class Foo { } and multi-line:
    //    class Foo {
    //    }
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('class ') && line.includes('{')) {
            // Found start of class definition
            const classNameMatch = line.match(/class\s+(\w+)/);
            if (!classNameMatch) continue;
            
            const className = classNameMatch[1];
            
            // Check if next non-empty line is closing brace
            let j = i + 1;
            while (j < lines.length && lines[j].trim() === '') {
                j++;
            }
            if (j < lines.length && lines[j].trim() === '}') {
                return {
                    valid: false,
                    error: `Empty class definition: "${className}". Class must have at least one method or attribute.`
                };
            }
        }
    }
    
    return { valid: true };
}

/**
 * Mermaid syntax validation for State Diagram
 */
function validateStateSyntax(lines: string[]): { valid: boolean; error?: string } {
    const hasStates = lines.some(l => l.trim().startsWith('state'));
    const hasTransitions = lines.some(l => l.includes('-->'));
    if (!hasStates && !hasTransitions) {
        return {
            valid: false,
            error: 'No states or transitions found. Check the tags.'
        };
    }
    return { valid: true };
}

/**
 * Mermaid syntax validation for ER Diagram
 */
function validateERSyntax(lines: string[]): { valid: boolean; error?: string } {
    const hasEntities = lines.some(l => /\w+\s*\{/.test(l));
    if (!hasEntities) {
        return {
            valid: false,
            error: 'No entities found. Check the tags.'
        };
    }
    return { valid: true };
}

/**
 * Validates the Mermaid syntax based on the diagram type
 */
export function validateMermaidForType(mermaidCode: string, diagramType: string): { valid: boolean; error?: string } {
    const lines = mermaidCode.split('\n').filter(l => !l.trim().startsWith('subgraph'));
    const typeKey = diagramType.toLowerCase().replace(/\s+/g, '');

    if (typeKey.startsWith('flowchart') || typeKey.startsWith('graph')) {
        return validateFlowchartSyntax(lines);
    }
    if (typeKey.startsWith('sequencediagram')) {
        return validateSequenceSyntax(lines);
    }
    if (typeKey.startsWith('classdiagram')) {
        return validateClassSyntax(lines);
    }
    if (typeKey.startsWith('statediagram') || typeKey.includes('state')) {
        return validateStateSyntax(lines);
    }
    if (typeKey.startsWith('erdiagram')) {
        return validateERSyntax(lines);
    }

    // For other types, lenient validation
    return { valid: true };
}