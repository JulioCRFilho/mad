import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

export const ganttGenerator: DiagramGenerator = {
    type: 'gantt',
    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('gantt');
    },
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;

        for (const tag of tags) {
            if (!/\d/.test(tag.id)) {
                mermaid += `    section ${tag.id}\n`;
                continue;
            }

            const taskLabel = tag.label;
            const desc = tag.description || taskLabel;
            const durationMatch = desc.match(/(\d+)\s*(d|w|h)/);
            const duration = durationMatch ? `${durationMatch[1]}${durationMatch[2]}` : '1d';

            mermaid += `    ${taskLabel} : ${tag.id}, ${duration}\n`;
        }

        return mermaid;
    }
};