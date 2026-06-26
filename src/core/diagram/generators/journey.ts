import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

export const journeyGenerator: DiagramGenerator = {
    type: 'journey',
    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('journey');
    },
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;
        const sections: Map<string, string[]> = new Map();

        for (const tag of tags) {
            if (!/\d/.test(tag.id)) {
                if (!sections.has(tag.id)) sections.set(tag.id, []);
                continue;
            }

            const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
            if (groupMatch) {
                const groupId = groupMatch[1];
                if (sections.has(groupId)) sections.get(groupId)!.push(tag.label);
            }
        }

        for (const [section, tasks] of sections) {
            mermaid += `    section ${section}\n`;
            for (const task of tasks) mermaid += `      ${task}: 5: ${section}\n`;
        }

        return mermaid;
    }
};