import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

export const erGenerator: DiagramGenerator = {
    type: 'erDiagram',
    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('erdiagram');
    },
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;
        const entities = new Map<string, string[]>();
        const relationships: string[] = [];

        for (const tag of tags) {
            if (!/\d/.test(tag.id)) {
                if (!entities.has(tag.id)) entities.set(tag.id, []);
                continue;
            }

            const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
            if (groupMatch) {
                const groupId = groupMatch[1];
                if (entities.has(groupId)) entities.get(groupId)!.push(tag.label);
            }

            if (tag.connections && tag.connections.length > 0) {
                for (const conn of tag.connections) {
                    relationships.push(`    ${tag.id.match(/^([a-zA-Z_]+)/)?.[1] || tag.id} ||--o{ ${conn.id} : ${conn.label || 'has'}`);
                }
            }
        }

        for (const [entityName, attrs] of entities) {
            mermaid += `    ${entityName} {\n`;
            for (const attr of attrs) mermaid += `        string ${attr.replace(/\s+/g, '_')}\n`;
            mermaid += '    }\n';
        }
        for (const rel of relationships) mermaid += rel + '\n';

        return mermaid;
    }
};