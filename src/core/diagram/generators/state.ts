import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

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

        for (const tag of tags) {
            if (!/\d/.test(tag.id)) {
                if (!states.has(tag.id)) states.set(tag.id, []);
                continue;
            }

            const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
            if (groupMatch) {
                const groupId = groupMatch[1];
                if (states.has(groupId)) states.get(groupId)!.push(tag.label);
            }

            if (tag.connections && tag.connections.length > 0) {
                for (const conn of tag.connections) {
                    const source = tag.id.match(/^([a-zA-Z_]+)/)?.[1] || tag.id;
                    transitions.push(`    ${source} --> ${conn.id}${conn.label ? ': ' + conn.label : ''}`);
                }
            }
        }

        const edges = new Set<string>();
        for (const tag of tags) {
            if (tag.id.includes('.')) {
                const lastDot = tag.id.lastIndexOf('.');
                const parentId = tag.id.substring(0, lastDot);
                const parentTag = tags.find(t => t.id === parentId);
                if (parentTag) {
                    const src = parentTag.id.match(/^([a-zA-Z_]+)/)?.[1] || parentTag.id;
                    const dst = tag.id.match(/^([a-zA-Z_]+)/)?.[1] || tag.id;
                    const key = `${src}->${dst}`;
                    if (!edges.has(key)) {
                        edges.add(key);
                        transitions.push(`    ${src} --> ${dst}`);
                    }
                }
            }
        }

        for (const stateId of states.keys()) {
            mermaid += `    state "${stateId}" {\n`;
            const actions = states.get(stateId) || [];
            for (const action of actions) {
                mermaid += `        ${stateId.toLowerCase()}_${action.replace(/\s+/g, '')} : ${action}\n`;
            }
            mermaid += '    }\n';
        }

        for (const trans of transitions) mermaid += trans + '\n';

        return mermaid;
    }
};