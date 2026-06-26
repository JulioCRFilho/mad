import { ProcessedNode } from './parser';

/**
 * Extrai o(s) número(s) do ID de um nó para ordenação.
 * Ex: "Login1" → [1], "Login1.1" → [1, 1], "Login1.1.2" → [1, 1, 2]
 */
function extractNumbersFromId(id: string): number[] {
    const match = id.match(/\d+(\.\d+)*/g);
    if (!match) return [0];
    return match[0].split('.').map(Number);
}

/**
 * Gera o código Mermaid estilizado baseado nas tags relacionadas.
 * Usa o diagramType salvo (ex: "flowchart TD", "graph TD") com cores temáticas.
 */
export function generateMermaidDiagram(tags: ProcessedNode[], diagramType: string = 'flowchart TD'): string {
    if (tags.length === 0) {
        return `${diagramType}\n    A[Nenhuma tag relacionada encontrada]`;
    }

    const groups = tags.filter(t => !/\d/.test(t.id));
    const numbered = tags.filter(t => /\d/.test(t.id));

    const sortedGroups = [...groups].sort((a, b) => a.id.localeCompare(b.id));

    // Separa nós de entrada (prefixo + número inteiro: auth1, ID2, Login1...) de nós subsequentes (auth1.1, auth1.2...)
    // Exclui nós sintéticos de //@-> que têm formato Nome_Numero (ex: Login_0)
    const entryNodes = numbered.filter(t => /^[a-zA-Z]+[0-9]+$/.test(t.id));
    const sequenceNodes = numbered.filter(t => /\.[0-9]/.test(t.id));
    const syntheticNodes = numbered.filter(t => /^[a-zA-Z]+_[0-9]+$/.test(t.id));

    // Ordenação correta por números extraídos do ID
    const sortedEntryNodes = [...entryNodes].sort((a, b) => {
        const numsA = extractNumbersFromId(a.id);
        const numsB = extractNumbersFromId(b.id);
        for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
            const diff = (numsA[i] || 0) - (numsB[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    });

    const sortedSequenceNodes = [...sequenceNodes].sort((a, b) => {
        const numsA = extractNumbersFromId(a.id);
        const numsB = extractNumbersFromId(b.id);
        for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
            const diff = (numsA[i] || 0) - (numsB[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    });

    let mermaid = `${diagramType}\n`;
    const idToNodeId = new Map<string, string>();
    let nodeIndex = 0;

    const allocated = new Set<string>();

    for (const group of sortedGroups) {
        // Grupos não precisam de formatação de label, usar o ID diretamente
        const safeLabel = group.id.replace(/"/g, '"');
        mermaid += `    subgraph ${safeLabel}\n`;

        // Nós de entrada (números inteiros) que pertencem a este grupo
        const groupEntryNodes = sortedEntryNodes.filter(entry => {
            const entryLower = entry.id.toLowerCase();
            const groupLower = group.id.toLowerCase();
            return entryLower === groupLower || entryLower.startsWith(groupLower);
        });

        for (const entry of groupEntryNodes) {
            const nodeId = `N${nodeIndex++}`;
            const safeLabel = entry.label.replace(/"/g, '"').replace(/\n/g, ' ');
            idToNodeId.set(entry.id, nodeId);
            mermaid += `        ${nodeId}["${safeLabel}"]\n`;
            allocated.add(entry.id);
        }

        // Nós subsequentes (1.1, 1.2, 2.1...) que pertencem a este grupo
        const groupSequenceNodes = sortedSequenceNodes.filter(seq => {
            const seqLower = seq.id.toLowerCase();
            const groupLower = group.id.toLowerCase();
            return seqLower.startsWith(groupLower);
        });

        for (const seq of groupSequenceNodes) {
            const nodeId = `N${nodeIndex++}`;
            const safeLabel = seq.label.replace(/"/g, '"').replace(/\n/g, ' ');
            idToNodeId.set(seq.id, nodeId);
            mermaid += `        ${nodeId}["${safeLabel}"]\n`;
            allocated.add(seq.id);
        }

        mermaid += `    end\n`;
    }

    // Nós sintéticos (//@->) que sempre ficam fora dos grupos
    for (const item of syntheticNodes) {
        const nodeId = `N${nodeIndex++}`;
        const safeLabel = item.label.replace(/"/g, '"').replace(/\n/g, ' ');
        idToNodeId.set(item.id, nodeId);
        mermaid += `    ${nodeId}["${safeLabel}"]\n`;
    }

    const edges = new Set<string>();

    const addEdge = (from: string, to: string, label?: string) => {
        const key = label ? `${from}->${to}:${label}` : `${from}->${to}`;
        if (edges.has(key)) return;
        edges.add(key);
        if (label && label.trim()) {
            mermaid += `    ${from} -->|${label.replace(/"/g, '"')}| ${to}\n`;
        } else {
            mermaid += `    ${from} --> ${to}\n`;
        }
    };

    // Arestas de pai-filho imediato (entryNode → sequenceNode ou sequenceNode → sequenceNode filho)
    // Conecta cada nó ao seu pai direto baseado no ID
    // Ex: "auth1" ← "auth1.1" (1 dot), "auth1.1" ← "auth1.1.1" (last dot)
    for (const seq of sortedSequenceNodes) {
        const src = idToNodeId.get(seq.id);
        if (!src) continue;

        // Acha o pai imediato (ex: "auth1.1" → pai "auth1", "auth1.2.1" → pai "auth1.2")
        const lastDot = seq.id.lastIndexOf('.');
        if (lastDot > 0) {
            const parentId = seq.id.substring(0, lastDot);
            const parentNode = idToNodeId.get(parentId);
            if (parentNode && parentNode !== src) {
                // Procura o label da descrição no nó filho (description = //@ID:desc)
                const seqNode = [...sortedSequenceNodes].find(s => s.id === seq.id);
                const label = seqNode?.description || undefined;
                addEdge(parentNode, src, label);
            }
        }
    }

    // Conexões explícitas (//@->ID:desc)
    for (const item of [...sortedEntryNodes, ...sortedSequenceNodes, ...syntheticNodes]) {
        const src = idToNodeId.get(item.id);
        if (!src) continue;

        if (item.connections && item.connections.length > 0) {
            for (const conn of item.connections) {
                const dst = idToNodeId.get(conn.id);
                if (dst) {
                    addEdge(src, dst, conn.label || undefined);
                }
            }
        }
    }

    return mermaid;
}