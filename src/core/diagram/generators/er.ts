//@::graph TD

import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

/**
 * Extract attributes from a CREATE TABLE block
 */
//@extractCreateTableAttributes
function extractCreateTableAttributes(code: string): string[] {
    const attrs: string[] = [];
    
    //@extractCreateTableAttributes1:Match CREATE TABLE pattern
    const match = code.match(/CREATE\s+TABLE\s+\w+\s*\(([\s\S]+)\)/i);
    if (!match) return attrs;
    
    const columnsBlock = match[1];
    
    //@extractCreateTableAttributes1->extractCreateTableAttributes2:Smart-split by commas (respect paren depth)
    //@extractCreateTableAttributes2:Columns split
    const lines: string[] = [];
    let current = '';
    let depth = 0;
    
    for (const char of columnsBlock) {
        if (char === '(') depth++;
        else if (char === ')') depth--;
        
        if (char === ',' && depth === 0) {
            lines.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) lines.push(current.trim());
    
    //@extractCreateTableAttributes2->extractCreateTableAttributes3:Parse column names from each line
    //@extractCreateTableAttributes3:Column names extracted
    for (const line of lines) {
        if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|INDEX|KEY|FULLTEXT)/i.test(line)) {
            continue;
        }
        
        const columnMatch = line.match(/^(\w+)/);
        if (columnMatch) {
            attrs.push(columnMatch[1]);
        }
    }
    
    return attrs;
}

//@erGenerator
export const erGenerator: DiagramGenerator = {
    type: 'erDiagram',

    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('erdiagram');
    },

    //@erGenerator1
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;
        const entities = new Map<string, string[]>();
        const relationships: string[] = [];

        //@erGenerator1->erGenerator2:First pass — collect entities and extract SQL attributes
        //@erGenerator2:Entities collected
        for (const tag of tags) {
            if (tag.id.includes('->')) continue;

            if (!/\d/.test(tag.id)) {
                if (!entities.has(tag.id)) entities.set(tag.id, []);
                
                if (tag.label && tag.label.toUpperCase().startsWith('CREATE TABLE')) {
                    const attrs = extractCreateTableAttributes(tag.label);
                    entities.set(tag.id, attrs);
                }
            }
        }

        //@erGenerator2->erGenerator3:Second pass — process relationships from connections
        //@erGenerator3:Relationships processed
        for (const tag of tags) {
            if (!tag.id.includes('->') && tag.connections && tag.connections.length > 0) {
                for (const conn of tag.connections) {
                    const label = conn.label || 'has';
                    const needsQuotes = /[\s\/\\,:;!@#$%^&*()+=]/.test(label);
                    const formattedLabel = needsQuotes ? `"${label}"` : label;

                    let leftSide = tag.id;
                    let rightSide = conn.id;
                    let cardinality = '||--o{';

                    if (/^(has.one|billing|shipping)$/i.test(label.trim())) {
                        cardinality = '||--||';
                    }

                    if (/^references$/i.test(label.trim())) {
                        leftSide = conn.id;
                        rightSide = tag.id;
                    }

                    relationships.push(`    ${leftSide} ${cardinality} ${rightSide} : ${formattedLabel}`);
                }
            }
        }

        //@erGenerator3->erGenerator4:Render entity definitions and relationships
        //@erGenerator4:ER diagram rendered
        for (const [entityName, attrs] of entities) {
            mermaid += `    ${entityName} {\n`;
            for (const attr of attrs) {
                mermaid += `        string ${attr.replace(/\s+/g, '_')}\n`;
            }
            mermaid += '    }\n';
        }
        
        for (const rel of relationships) {
            mermaid += rel + '\n';
        }

        return mermaid;
    }
};