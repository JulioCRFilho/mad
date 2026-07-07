//@::graph TD

import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

/** Accent map: Portuguese/Spanish/Italian accented chars to ASCII. */
const ACCENT_MAP: Record<string, string> = {
    'á':'a','à':'a','â':'a','ã':'a','ä':'a',
    'é':'e','è':'e','ê':'e','ë':'e',
    'í':'i','ì':'i','î':'i','ï':'i',
    'ó':'o','ò':'o','ô':'o','õ':'o','ö':'o',
    'ú':'u','ù':'u','û':'u','ü':'u',
    'ý':'y','ÿ':'y',
    'ç':'c','ñ':'n',
    'Á':'A','À':'A','Â':'A','Ã':'A','Ä':'A',
    'É':'E','È':'E','Ê':'E','Ë':'E',
    'Í':'I','Ì':'I','Î':'I','Ï':'I',
    'Ó':'O','Ò':'O','Ô':'O','Õ':'O','Ö':'O',
    'Ú':'U','Ù':'U','Û':'U','Ü':'U',
    'Ý':'Y','Ç':'C','Ñ':'N',
};

/** Sanitises a label for Mermaid: normalises accents, replaces special chars. */
function sanitizeLabel(label: string): string {
    return label
        .replace(/[áàâãäéèêëíìîïóòôõöúùûüýÿçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÝÇÑ]/g,
            (c) => ACCENT_MAP[c] || c)
        .replace(/&/g, ' and')
        .replace(/[()]/g, '')
        .replace(/\u2014/g, '-')
        .replace(/\u2013/g, '-')
        .replace(/"/g, '\'')
        .replace(/\n/g, ' ')
        .replace(/\s{2,}/g, ' ');
}

//@stateGenerator
export const stateGenerator: DiagramGenerator = {
    type: 'stateDiagram',

    matches(diagramType: string): boolean {
        const key = diagramType.toLowerCase();
        return key.startsWith('statediagram') || key.includes('state');
    },

    //@stateGenerator1
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;
        const states = new Map<string, string[]>();
        const transitions: string[] = [];
        const addedEdges = new Set<string>();

        //@stateGenerator1->stateGenerator2:Collect states and actions from tags
        //@stateGenerator2:States and actions collected
        for (const tag of tags) {
            if (tag.id.includes('->')) continue;

            if (!/\d/.test(tag.id)) {
                if (!states.has(tag.id)) states.set(tag.id, []);
                continue;
            }

            const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
            if (groupMatch) {
                const groupId = groupMatch[1];
                if (states.has(groupId)) {
                    const safeLabel = sanitizeLabel(tag.label);
                    const actionId = safeLabel.replace(/[^a-zA-Z0-9_]/g, '');
                    const displayLabel = tag.description ? sanitizeLabel(tag.description) : safeLabel;
                    states.get(groupId)!.push(`${actionId}: ${displayLabel}`);
                }
            }
        }

        //@stateGenerator2->stateGenerator3:Process transitions from group connections
        //@stateGenerator3:Transitions processed
        for (const tag of tags) {
            if (!/\d/.test(tag.id) && tag.connections && tag.connections.length > 0) {
                for (const conn of tag.connections) {
                    const key = `${tag.id}->${conn.id}`;
                    if (!addedEdges.has(key)) {
                        addedEdges.add(key);
                        transitions.push(`    ${tag.id} --> ${conn.id}${conn.label ? ': ' + sanitizeLabel(conn.label) : ''}`);
                    }
                }
            }
        }

        //@stateGenerator3->stateGenerator4:Render state definitions (with or without actions)
        //@stateGenerator4:State definitions rendered
        for (const stateId of states.keys()) {
            const actions = states.get(stateId) || [];
            if (actions.length === 0) {
                mermaid += `    state ${stateId}\n`;
            } else {
                mermaid += `    state ${stateId} {\n`;
                for (const action of actions) {
                    mermaid += `        ${action}\n`;
                }
                mermaid += '    }\n';
            }
        }

        //@stateGenerator4->stateGenerator5:Render transitions to Mermaid
        //@stateGenerator5:Transitions rendered — Mermaid ready
        for (const trans of transitions) mermaid += trans + '\n';

        return mermaid;
    }
};