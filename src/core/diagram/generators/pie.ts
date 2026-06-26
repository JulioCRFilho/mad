import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

export const pieGenerator: DiagramGenerator = {
    type: 'pie',
    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('pie');
    },
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;

        for (const tag of tags) {
            if (!/\d/.test(tag.id)) {
                if (tag.description) mermaid = `${diagramType} "${tag.id}"\n`;
                continue;
            }

            const label = tag.label;
            const value = tag.description || '10';
            mermaid += `    "${label}" : ${value}\n`;
        }

        return mermaid;
    }
};