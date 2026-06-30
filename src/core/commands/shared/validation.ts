import { filterAllNodes } from '../../diagram/parser';
import { validateDiagram, ValidationResult } from '../../diagram/validator';

export type { ValidationResult } from '../../diagram/validator';

export interface TagInfo {
    id: string;
    line: number;
    isConnection: boolean;
    targetIds: string[];
    connections?: Array<{ id: string; label: string; arrowPrefix?: string }>;
}

/**
 * Valida a estrutura MAD do diagrama
 */
export function validateMADStructure(document: import('vscode').TextDocument, prefix: string): ValidationResult {
    const allNodes = filterAllNodes(document);
    return validateDiagram(allNodes, prefix);
}

/**
 * Parseia todas as tags MAD de um texto
 */
export function parseAllTags(text: string, lines: string[]): TagInfo[] {
    const allTags: TagInfo[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        let tagId: string | null = null;
        let isConnection = false;
        let targetIds: string[] = [];
        
        const normalMatch = line.match(/\/\/@([\w.]+)(?::([^\n]+))?/);
        const implicitMatch = line.match(/\/\/@->([\w.]+)/);
        const explicitMatch = line.match(/\/\/@([\w.]+)->([\w.]+)/);
        const classMatch = line.match(/\/\/@(<\|--|--|\*--|o--|-->)([\w.]+)/);
        const classInlineMatch = line.match(/\/\/@([\w.]+)(<\|--|--|\*--|o--|-->)([\w.]+)/);
        
        if (classInlineMatch) {
            tagId = `${classInlineMatch[1]}->${classInlineMatch[3]}`;
            isConnection = true;
            targetIds.push(classInlineMatch[3]);
        } else if (explicitMatch) {
            tagId = `${explicitMatch[1]}->${explicitMatch[2]}`;
            isConnection = true;
            targetIds.push(explicitMatch[2]);
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
        }
        
        if (!tagId) continue;
        if (tagId.startsWith('::')) continue;
        
        const tagInfo: TagInfo = { id: tagId, line: i, isConnection, targetIds };
        
        // Adiciona connections se for um nó com conexões
        if (!isConnection && normalMatch && normalMatch[2]) {
            // Aqui poderíamos parsear connections se necessário
            // Por enquanto, deixamos undefined
        }
        
        allTags.push(tagInfo);
    }
    return allTags;
}

/**
 * Conta elementos (nós e conexões) no código Mermaid
 */
export function countDiagramElements(mermaidCode: string): { nodes: number; connections: number } {
    let nodes = 0;
    let connections = 0;
    const diagramLines = mermaidCode.split(/\r?\n/);
    for (const line of diagramLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Nós
        if (trimmed.startsWith('participant ')) { nodes++; continue; }
        if (/^class\s+\w+/.test(trimmed)) { nodes++; continue; }
        if (trimmed.startsWith('subgraph ')) { nodes++; continue; }
        if (/^state\s+\w+/.test(trimmed) && !trimmed.includes(':')) { nodes++; continue; }
        if (/^\w+\s*\{$/.test(trimmed)) { nodes++; continue; }
        
        // Conexões - verifica padrões específicos
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
 * Verifica tags soltas (entry nodes sem código abaixo)
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
            issues.push(`Tag solta: ${tag.id} (linha ${tag.line + 1})`);
        }
    }
    return issues;
}

/**
 * Verifica conexões apontando para IDs inexistentes
 */
export function findInvalidReferences(allTags: TagInfo[]): string[] {
    const issues: string[] = [];
    const validIds = new Set(allTags.map(t => t.id));
    for (const tag of allTags) {
        if (!tag.isConnection) continue;
        for (const targetId of tag.targetIds) {
            if (!validIds.has(targetId)) {
                issues.push(`Conexão ${tag.id} aponta para ID inexistente: ${targetId}`);
            }
        }
    }
    return issues;
}

// ── Validações específicas por tipo de diagrama ──

function validateClassDiagramCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    const expectedNodes = allTags.filter(t => !t.isConnection && !/\d/.test(t.id)).length;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagrama(${diagramNodes})`);
    }
    const connectionCount = allTags.filter(t => t.isConnection).length;
    if (connectionCount !== diagramConnections) {
        issues.push(`Conexões(${connectionCount}) ≠ Diagrama(${diagramConnections})`);
    }
    return issues;
}

function validateSequenceDiagramCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    const expectedNodes = allTags.filter(t => !t.isConnection && !/\d/.test(t.id)).length;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagrama(${diagramNodes})`);
    }
    // Em sequenceDiagram, tanto conexões explícitas quanto entry nodes viram mensagens
    const explicitConnections = allTags.filter(t => t.isConnection).length;
    const entryNodes = allTags.filter(t => !t.isConnection && /\d/.test(t.id) && /^[a-zA-Z_]+[0-9]+$/.test(t.id)).length;
    const expectedConnections = explicitConnections + entryNodes;
    if (expectedConnections !== diagramConnections) {
        issues.push(`Conexões(${expectedConnections}) ≠ Diagrama(${diagramConnections})`);
    }
    return issues;
}

function validateFlowchartCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    const expectedNodes = allTags.filter(t => !t.isConnection && !/\d/.test(t.id)).length;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagrama(${diagramNodes})`);
    }
    
    // Simula o que o generator faz para contar conexões esperadas
    const tagNodes = allTags.filter(t => !t.isConnection);
    const groups = tagNodes.filter(t => !/\d/.test(t.id));
    const numbered = tagNodes.filter(t => /\d/.test(t.id));
    const entryNodes = numbered.filter(t => /^[a-zA-Z]+[0-9]+$/.test(t.id));
    const sequenceNodes = numbered.filter(t => /\.[0-9]/.test(t.id));
    
    // Conta conexões únicas que o generator irá criar
    const edges = new Set<string>();
    
    // 1. Conexões implícitas de sequence nodes (linhas 97-109 do generator)
    for (const seq of sequenceNodes) {
        const lastDot = seq.id.lastIndexOf('.');
        if (lastDot > 0) {
            const parentId = seq.id.substring(0, lastDot);
            // Verifica se parentId existe como grupo ou node
            const parentExists = groups.some(g => g.id === parentId) || 
                                numbered.some(n => n.id === parentId);
            if (parentExists) {
                const key = `${parentId}->${seq.id}`;
                edges.add(key);
            }
        }
    }
    
    // 2. Conexões explícitas das tags (linhas 111-120 do generator)
    // No flowchart, as conexões são tags do tipo //@->Target ou //@Source->Target
    const connectionTags = allTags.filter(t => t.isConnection);
    for (const conn of connectionTags) {
        // Extrai source e target da tag
        // Formato: "Source->Target" ou "->Target"
        if (conn.id.includes('->')) {
            const key = conn.id;
            edges.add(key);
        }
    }
    
    const expectedConnections = edges.size;
    if (expectedConnections !== diagramConnections) {
        issues.push(`Conexões(${expectedConnections}) ≠ Diagrama(${diagramConnections})`);
    }
    
    return issues;
}

function validateStateDiagramCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    const expectedNodes = allTags.filter(t => !t.isConnection && !/\d/.test(t.id)).length;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagrama(${diagramNodes})`);
    }
    const connectionCount = allTags.filter(t => t.isConnection).length;
    if (connectionCount !== diagramConnections) {
        issues.push(`Conexões(${connectionCount}) ≠ Diagrama(${diagramConnections})`);
    }
    return issues;
}

function validateERDiagramCounts(allTags: TagInfo[], diagramNodes: number, diagramConnections: number): string[] {
    const issues: string[] = [];
    const expectedNodes = allTags.filter(t => !t.isConnection).length;
    if (expectedNodes !== diagramNodes) {
        issues.push(`Tags(${expectedNodes}) ≠ Diagrama(${diagramNodes})`);
    }
    const connectionCount = allTags.filter(t => t.isConnection).length;
    if (connectionCount !== diagramConnections) {
        issues.push(`Conexões(${connectionCount}) ≠ Diagrama(${diagramConnections})`);
    }
    return issues;
}

/**
 * Valida se o diagrama gerado tem a mesma quantidade de elementos que as tags MAD
 * Retorna array de issues (vazio = tudo ok)
 */
export function validateDiagramCounts(
    documentText: string,
    mermaidCode: string,
    diagramType: string
): string[] {
    const lines = documentText.split(/\r?\n/);
    const allTags = parseAllTags(documentText, lines);
    const { nodes: diagramNodes, connections: diagramConnections } = countDiagramElements(mermaidCode);
    
    const issues: string[] = [];
    const typeKey = diagramType.toLowerCase().replace(/\s+/g, '');
    
    if (typeKey.startsWith('classdiagram')) {
        issues.push(...validateClassDiagramCounts(allTags, diagramNodes, diagramConnections));
    } else if (typeKey.startsWith('sequencediagram')) {
        issues.push(...validateSequenceDiagramCounts(allTags, diagramNodes, diagramConnections));
    } else if (typeKey.startsWith('flowchart') || typeKey.startsWith('graph')) {
        issues.push(...validateFlowchartCounts(allTags, diagramNodes, diagramConnections));
    } else if (typeKey.startsWith('statediagram') || typeKey.includes('state')) {
        issues.push(...validateStateDiagramCounts(allTags, diagramNodes, diagramConnections));
    } else if (typeKey.startsWith('erdiagram')) {
        issues.push(...validateERDiagramCounts(allTags, diagramNodes, diagramConnections));
    }
    
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