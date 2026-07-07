//@::graph TD

import { ProcessedNode } from '../parser';
import { DiagramGenerator, extractNumbersFromId } from './types';

/** Sanitises a label for Mermaid: replaces special characters that break
 *  the browser renderer (ampersands, parentheses, em/en dashes). */
function sanitizeLabel(label: string): string {
    return label
        .replace(/&/g, ' and')
        .replace(/[()]/g, '')
        .replace(/\u2014/g, '-')
        .replace(/\u2013/g, '-')
        .replace(/"/g, '\'')
        .replace(/\n/g, ' ')
        .replace(/\s{2,}/g, ' ');
}

//@flowchartGenerator
export const flowchartGenerator: DiagramGenerator = {
    type: 'flowchart',

    matches(diagramType: string): boolean {
        const key = diagramType.toLowerCase();
        return key.startsWith('flowchart') || key.startsWith('graph');
    },

    //@flowchartGenerator1
    generate(tags: ProcessedNode[], diagramType: string): string {
        const groups = tags.filter(t => !/\d/.test(t.id));
        const numbered = tags.filter(t => /\d/.test(t.id));
        const sortedGroups = [...groups].sort((a, b) => a.id.localeCompare(b.id));

        const entryNodes = numbered.filter(t => /^[a-zA-Z]+[0-9]+$/.test(t.id));
        const sequenceNodes = numbered.filter(t => /\.[0-9]/.test(t.id));
        const syntheticNodes = numbered.filter(t => /^[a-zA-Z]+_[0-9]+$/.test(t.id));

        //@flowchartGenerator1->flowchartGenerator2:Sort entry and sequence nodes by numeric ID
        //@flowchartGenerator2:Nodes classified and sorted
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

        //@flowchartGenerator2->flowchartGenerator3:Render subgraphs with entry and sequence nodes
        //@flowchartGenerator3:Subgraphs and synthetic nodes rendered
        for (const group of sortedGroups) {
            const safeLabel = group.id.replace(/"/g, '"');
            mermaid += `    subgraph ${safeLabel}\n`;

            const groupEntryNodes = sortedEntryNodes.filter(entry =>
                entry.id.toLowerCase() === group.id.toLowerCase() || entry.id.toLowerCase().startsWith(group.id.toLowerCase())
            );

            for (const entry of groupEntryNodes) {
                const nodeId = entry.id.replace(/\./g, '_');
                idToNodeId.set(entry.id, nodeId);
                mermaid += `        ${nodeId}["${sanitizeLabel(entry.label)}"]\n`;
            }

            const groupSequenceNodes = sortedSequenceNodes.filter(seq =>
                seq.id.toLowerCase().startsWith(group.id.toLowerCase())
            );

            for (const seq of groupSequenceNodes) {
                const nodeId = seq.id.replace(/\./g, '_');
                idToNodeId.set(seq.id, nodeId);
                mermaid += `        ${nodeId}["${sanitizeLabel(seq.label)}"]\n`;
            }

            const firstNode = groupEntryNodes[0] || groupSequenceNodes[0];
            if (firstNode) {
                idToNodeId.set(group.id, idToNodeId.get(firstNode.id)!);
            }

            mermaid += `    end\n`;
        }

        for (const item of syntheticNodes) {
            const nodeId = `N${nodeIndex++}`;
            idToNodeId.set(item.id, nodeId);
            mermaid += `    ${nodeId}["${sanitizeLabel(item.label)}"]\n`;
        }

        //@flowchartGenerator3->flowchartGenerator4:Add sequence parent-child edges with dedup
        //@flowchartGenerator4:Sequence edges added
        const edges = new Set<string>();
        const addEdge = (from: string, to: string, label?: string) => {
            const key = label ? `${from}->${to}:${label}` : `${from}->${to}`;
            if (edges.has(key)) return;
            edges.add(key);
            if (label && label.trim()) {
                mermaid += `    ${from} -->|${sanitizeLabel(label)}| ${to}\n`;
            } else {
                mermaid += `    ${from} --> ${to}\n`;
            }
        };

        for (const seq of sortedSequenceNodes) {
            const src = idToNodeId.get(seq.id);
            if (!src) continue;
            const lastDot = seq.id.lastIndexOf('.');
            if (lastDot > 0) {
                const parentId = seq.id.substring(0, lastDot);
                const parentNode = idToNodeId.get(parentId);
                if (parentNode && parentNode !== src) {
                    addEdge(parentNode, src, seq.description || undefined);
                }
            }
        }

        //@flowchartGenerator4->flowchartGenerator5:Add explicit connection edges
        //@flowchartGenerator5:Explicit edges added — Mermaid ready
        for (const item of [...sortedEntryNodes, ...sortedSequenceNodes, ...syntheticNodes]) {
            const src = idToNodeId.get(item.id);
            if (!src) continue;
            if (item.connections && item.connections.length > 0) {
                for (const conn of item.connections) {
                    const dst = idToNodeId.get(conn.id);
                    if (dst) addEdge(src, dst, conn.label || undefined);
                }
            }
        }

        return mermaid;
    }
};