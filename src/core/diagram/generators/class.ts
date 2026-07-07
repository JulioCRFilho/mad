//@::graph

import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

//@classGenerator
export const classGenerator: DiagramGenerator = {
    type: 'classDiagram',

    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('classdiagram');
    },

    //@classGenerator1
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;
        const classContents = new Map<string, string[]>();
        const relationships: string[] = [];

        //@classGenerator1->classGenerator2:Iterate tags to build classContents and relationships
        //@classGenerator2:For each tag — classify as group or numbered node
        for (const tag of tags) {
            if (!/\d/.test(tag.id)) {
                if (!classContents.has(tag.id)) classContents.set(tag.id, []);
                
                if (tag.connections && tag.connections.length > 0) {
                    for (const conn of tag.connections) {
                        if (/\.\d/.test(conn.id)) continue;
                        const arrow = conn.arrowPrefix || '-->';
                        const label = conn.label ? ` : ${conn.label}` : '';
                        if (arrow === '<|--') {
                            relationships.push(`${conn.id} ${arrow} ${tag.id}${label}`);
                        } else {
                            relationships.push(`${tag.id} ${arrow} ${conn.id}${label}`);
                        }
                    }
                }
                continue;
            }

            const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
            if (groupMatch) {
                const groupId = groupMatch[1];
                if (classContents.has(groupId)) classContents.get(groupId)!.push(`    +${tag.label}()`);
            }

            if (tag.connections && tag.connections.length > 0) {
                for (const conn of tag.connections) {
                    if (/\.\d/.test(conn.id)) continue;
                    const arrow = conn.arrowPrefix || '-->';
                    const className = tag.id.match(/^([a-zA-Z_]+)/)?.[1] || tag.id;
                    const label = conn.label ? ` : ${conn.label}` : '';
                    if (arrow === '<|--') {
                        relationships.push(`${conn.id} ${arrow} ${className}${label}`);
                    } else {
                        relationships.push(`${className} ${arrow} ${conn.id}${label}`);
                    }
                }
            }
        }

        //@classGenerator2->classGenerator3:Render class definitions
        //@classGenerator3:For each class — render class block with methods
        for (const [className, methods] of classContents) {
            mermaid += `    class ${className} {\n`;
            for (const method of methods) mermaid += method + '\n';
            mermaid += '    }\n';
        }

        //@classGenerator3->classGenerator4:Render relationships
        //@classGenerator4:For each relationship — render arrow line to Mermaid
        for (const rel of relationships) mermaid += `    ${rel}\n`;

        return mermaid;
    }
};