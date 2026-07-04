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

/** Sanitises a label for Mermaid: normalises accents, replaces special chars
 *  that break the browser renderer (ampersands, parentheses, em/en dashes). */
function sanitizeLabel(label: string): string {
    return label
        // Normalise accented chars before stripping non-word chars
        .replace(/[áàâãäéèêëíìîïóòôõöúùûüýÿçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÝÇÑ]/g,
            (c) => ACCENT_MAP[c] || c)
        .replace(/&/g, ' and')      // & → and
        .replace(/[()]/g, '')       // strip ()
        .replace(/\u2014/g, '-')    // em dash → hyphen
        .replace(/\u2013/g, '-')    // en dash → hyphen
        .replace(/"/g, '\'')        // " → '
        .replace(/\n/g, ' ')
        .replace(/\s{2,}/g, ' ');   // collapse double spaces
}

export const stateGenerator: DiagramGenerator = {
    type: 'stateDiagram',
    matches(diagramType: string): boolean {
        const key = diagramType.toLowerCase();
        return key.startsWith('statediagram') || key.includes('state');
    },
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;
        const states = new Map<string, string[]>();
        const transitions: string[] = [];
        const addedEdges = new Set<string>();

        for (const tag of tags) {
            // Ignore direct connections (//@Source->Target) - they will be processed later
            if (tag.id.includes('->')) continue;

            // Main states (without numbers)
            if (!/\d/.test(tag.id)) {
                if (!states.has(tag.id)) states.set(tag.id, []);
                continue;
            }

            // Actions of a state (LoggedOut1, LoggedOut1.1, etc)
            const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
            if (groupMatch) {
                const groupId = groupMatch[1];
                if (states.has(groupId)) {
                    // Format the action label, sanitising special characters
                    const safeLabel = sanitizeLabel(tag.label);
                    // Mermaid identifiers must be alphanumeric + underscore only.
                    // Strip hyphens, spaces, and any other non-word characters.
                    const actionId = safeLabel.replace(/[^a-zA-Z0-9_]/g, '');
                    const displayLabel = tag.description ? sanitizeLabel(tag.description) : safeLabel;
                    states.get(groupId)!.push(`${actionId}: ${displayLabel}`);
                }
            }
        }

        // Process tag.connections (coming from the diagram-command pipeline)
        // Includes both normal tag connections and direct connections (//@Source->Target)
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

        // Generate states (no quotes!)
        for (const stateId of states.keys()) {
            const actions = states.get(stateId) || [];
            if (actions.length === 0) {
                // Empty state — render as simple state to avoid tGe[a.shape] bug
                mermaid += `    state ${stateId}\n`;
            } else {
                mermaid += `    state ${stateId} {\n`;
                for (const action of actions) {
                    mermaid += `        ${action}\n`;
                }
                mermaid += '    }\n';
            }
        }

        // Add transitions
        for (const trans of transitions) mermaid += trans + '\n';

        return mermaid;
    }
};
