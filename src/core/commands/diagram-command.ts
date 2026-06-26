import * as vscode from 'vscode';
import { filterAllNodes, splitNodes, readDiagramType, ProcessedNode } from '../diagram/parser';
import { validateDiagram, ValidationError } from '../diagram/validator';
import { extractIdentifierBelow, formatCodeToLabel } from '../diagram/identifier';
import { generateMermaidDiagram } from '../diagram/generator';
import { MDDDDiagramPanel } from '../ui/diagram-panel';

export interface DiagramCommandContext {
    document: vscode.TextDocument;
    prefix: string;
    extensionUri: vscode.Uri;
}

export interface DiagramResult {
    success: boolean;
    errorMessage?: string;
}

/**
 * Extrai o código-fonte abaixo de uma tag, pulando linhas que são apenas tags consecutivas.
 */
function extractCodeLine(document: vscode.TextDocument, tagLine: number): string | null {
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    let j = tagLine + 1;
    while (j < lines.length && lines[j].match(/\/\/@/)) {
        j++;
    }
    if (j < lines.length) {
        return lines[j];
    }
    return null;
}

/**
 * Processa nós retro (//@ID): filtra por prefixo, extrai código, formata label.
 */
function processRetroPointers(
    document: vscode.TextDocument,
    retroPointers: Array<{ line: number; id: string; description: string | null }>,
    prefix: string
): Array<{ line: number; id: string; label: string; description: string | null }> {
    const prefixLower = prefix.toLowerCase();
    const result: Array<{ line: number; id: string; label: string; description: string | null }> = [];

    for (const node of retroPointers) {
        if (!node.id.toLowerCase().startsWith(prefixLower)) continue;

        const codeLine = extractCodeLine(document, node.line);
        const identifier = codeLine ? extractIdentifierBelow(codeLine) : null;
        const label = identifier ? formatCodeToLabel(identifier) : node.id;

        result.push({
            line: node.line,
            id: node.id,
            label: label,
            description: node.description
        });
    }

    return result;
}

/**
 * Verifica se uma linha de código já foi usada por um nó retro,
 * retornando o ID do nó retro correspondente, ou null se não encontrado.
 */
function findRetroNodeForLine(
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    document: vscode.TextDocument,
    forwardLine: number
): { id: string; line: number } | null {
    const codeLine = extractCodeLine(document, forwardLine);
    if (!codeLine) return null;

    // Verifica se algum nó retro tem a mesma linha de código abaixo dele
    for (const retro of retroNodes) {
        const retroCodeLine = extractCodeLine(document, retro.line);
        if (retroCodeLine === codeLine) {
            return { id: retro.id, line: retro.line };
        }
    }
    return null;
}

/**
 * Processa nós forward (//@->ID).
 * Se a linha de código já tem um nó retro associado, adiciona a conexão a esse nó.
 * Caso contrário, cria um nó sintético.
 */
function processForwardPointers(
    document: vscode.TextDocument,
    forwardPointers: Array<{ line: number; id: string; description: string | null }>,
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    prefix: string
): {
    syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string }> }>;
    extraConnections: Array<{ sourceId: string; targetId: string; label: string }>;
} {
    const prefixLower = prefix.toLowerCase();
    const syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string }> }> = [];
    const extraConnections: Array<{ sourceId: string; targetId: string; label: string }> = [];

    for (const node of forwardPointers) {
        if (!node.id.toLowerCase().startsWith(prefixLower)) continue;

        // Verifica se já existe um nó retro associado à mesma linha de código
        const existingRetro = findRetroNodeForLine(retroNodes, document, node.line);

        if (existingRetro) {
            // Adiciona conexão ao nó retro existente
            extraConnections.push({
                sourceId: existingRetro.id,
                targetId: node.id,
                label: node.description || ''
            });
        } else {
            // Cria nó sintético
            const codeLine = extractCodeLine(document, node.line);
            const identifier = codeLine ? extractIdentifierBelow(codeLine) : null;
            const sourceName = identifier || 'Unknown';
            const syntheticId = `${sourceName}_${node.line}`;
            const label = identifier ? formatCodeToLabel(identifier) : node.id;

            syntheticNodes.push({
                line: node.line,
                id: syntheticId,
                label: label,
                connections: [{ id: node.id, label: node.description || '' }]
            });
        }
    }

    return { syntheticNodes, extraConnections };
}

/**
 * Filtra nós por tipo (FilterGroups → FilterPrefix → FilterSequences),
 * adiciona conexões extras de forwards, remove duplicatas e ordena.
 */
function filterAndSortNodes(
    retroNodes: Array<{ line: number; id: string; label: string; description: string | null }>,
    syntheticNodes: Array<{ line: number; id: string; label: string; connections: Array<{ id: string; label: string }> }>,
    extraConnections: Array<{ sourceId: string; targetId: string; label: string }>
): ProcessedNode[] {
    const allNodes: Array<{ line: number; id: string; label: string; description: string | null; connections: Array<{ id: string; label: string }> }> = [
        ...retroNodes.map(n => ({ ...n, connections: [] as Array<{ id: string; label: string }> })),
        ...syntheticNodes.map(n => ({ ...n, description: null as string | null }))
    ];

    // Adiciona conexões extras aos nós correspondentes
    for (const conn of extraConnections) {
        const sourceNode = allNodes.find(n => n.id === conn.sourceId);
        if (sourceNode) {
            sourceNode.connections.push({ id: conn.targetId, label: conn.label });
        }
    }

    // Filtra por tipo: grupos, entry nodes, sequence nodes
    const groups = allNodes.filter(node => !/\d/.test(node.id));
    const prefixNodes = allNodes.filter(node => /^[a-zA-Z_]+[0-9]+$/.test(node.id));
    const sequenceNodes = allNodes.filter(node => /\.[0-9]+/.test(node.id));

    // Combina e normaliza
    const combined = [...groups, ...prefixNodes, ...sequenceNodes].map(node => ({
        line: node.line,
        id: node.id,
        label: node.label || node.id,
        description: node.description || null,
        connections: node.connections || []
    })) as ProcessedNode[];

    // Remove duplicatas mantendo ordem
    const unique = combined.filter((node, index, self) =>
        index === self.findIndex(n => n.id === node.id)
    );

    // Ordena: grupos primeiro (alfabético), depois entry nodes, depois sequence nodes
    const sortedGroups = unique.filter(n => !/\d/.test(n.id)).sort((a, b) => a.id.localeCompare(b.id));
    const sortedEntry = unique.filter(n => /^[a-zA-Z_]+[0-9]+$/.test(n.id)).sort((a, b) => {
        const numsA = a.id.match(/\d+(\.\d+)*/g)?.[0]?.split('.').map(Number) || [0];
        const numsB = b.id.match(/\d+(\.\d+)*/g)?.[0]?.split('.').map(Number) || [0];
        for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
            const diff = (numsA[i] || 0) - (numsB[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    });
    const sortedSeq = unique.filter(n => /\.[0-9]+/.test(n.id)).sort((a, b) => {
        const numsA = a.id.match(/\d+(\.\d+)*/g)?.[0]?.split('.').map(Number) || [0];
        const numsB = b.id.match(/\d+(\.\d+)*/g)?.[0]?.split('.').map(Number) || [0];
        for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
            const diff = (numsA[i] || 0) - (numsB[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    });

    return [...sortedGroups, ...sortedEntry, ...sortedSeq];
}

/**
 * Pipeline completo: filtra nós → separa tipos → processa retro → processa forward → filtra, ordena e retorna.
 */
function findRelatedTags(document: vscode.TextDocument, prefix: string): ProcessedNode[] {
    const allNodes = filterAllNodes(document);
    const { retroPointers, forwardPointers } = splitNodes(allNodes);

    const processedRetro = processRetroPointers(document, retroPointers, prefix);
    const { syntheticNodes, extraConnections } = processForwardPointers(document, forwardPointers, processedRetro, prefix);

    return filterAndSortNodes(processedRetro, syntheticNodes, extraConnections);
}

/**
 * Valida e exibe o diagrama, retornando mensagem de erro se inválido
 */
export function validateAndDisplayDiagram(context: DiagramCommandContext): DiagramResult {
    // Step 1: Read diagram type from first line
    const diagramType = readDiagramType(context.document);

    // Step 2: Filter all nodes
    const allNodes = filterAllNodes(context.document);

    // Step 3: Validate diagram structure
    const validation = validateDiagram(allNodes, context.prefix);

    if (!validation.valid) {
        const errorMessages = validation.errors.map(e =>
            `Linha ${e.line + 1}: ${e.message}`
        ).join('\n');

        return {
            success: false,
            errorMessage: `Diagrama inválido:\n${errorMessages}`
        };
    }

    // Step 4: Find related tags
    const relatedTags = findRelatedTags(context.document, context.prefix);

    // Step 5: Generate diagram with saved diagram type
    const mermaidCode = generateMermaidDiagram(relatedTags, diagramType);

    // Step 6: Display diagram
    MDDDDiagramPanel.createOrShow(context.extensionUri, mermaidCode);

    return { success: true };
}
