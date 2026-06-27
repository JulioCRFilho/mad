import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

/**
 * Extrai atributos de um bloco CREATE TABLE
 */
function extractCreateTableAttributes(code: string): string[] {
    const attrs: string[] = [];
    
    // Encontra o bloco entre parênteses
    const match = code.match(/CREATE\s+TABLE\s+\w+\s*\(([\s\S]+)\)/i);
    if (!match) return attrs;
    
    const columnsBlock = match[1];
    
    // Split inteligente por vírgulas, respeitando parênteses
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
    
    for (const line of lines) {
        // Ignora linhas que são constraints (PRIMARY KEY, FOREIGN KEY, etc.)
        // Inclui FULLTEXT que é um tipo de índice, não coluna
        if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT|INDEX|KEY|FULLTEXT)/i.test(line)) {
            continue;
        }
        
        // Extrai o nome da coluna (primeira palavra antes de espaço ou parêntese)
        const columnMatch = line.match(/^(\w+)/);
        if (columnMatch) {
            attrs.push(columnMatch[1]);
        }
    }
    
    return attrs;
}

export const erGenerator: DiagramGenerator = {
    type: 'erDiagram',
    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('erdiagram');
    },
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;
        const entities = new Map<string, string[]>();
        const relationships: string[] = [];

        // Primeira passada: coleta entidades e seus atributos
        for (const tag of tags) {
            // Ignora relacionamentos (tags com ->)
            if (tag.id.includes('->')) {
                continue;
            }

            // Entidades (IDs sem números)
            if (!/\d/.test(tag.id)) {
                if (!entities.has(tag.id)) {
                    entities.set(tag.id, []);
                }
                
                // Extrai atributos do código SQL no label
                if (tag.label && tag.label.toUpperCase().startsWith('CREATE TABLE')) {
                    const attrs = extractCreateTableAttributes(tag.label);
                    entities.set(tag.id, attrs);
                }
            }
        }

        // Segunda passada: processa relacionamentos a partir das conexões dos nós
        // Inclui tanto conexões de tags normais quanto conexões diretas (//@Source->Target)
        for (const tag of tags) {
            // Processa apenas nós que têm conexões (ignora tags com -> no ID, que são tratadas como connections)
            if (!tag.id.includes('->') && tag.connections && tag.connections.length > 0) {
                for (const conn of tag.connections) {
                    const label = conn.label || 'has';
                    // Labels com espaços ou caracteres especiais (/, etc.) precisam de aspas no Mermaid
                    const needsQuotes = /[\s\/\\,:;!@#$%^&*()+=]/.test(label);
                    const formattedLabel = needsQuotes ? `"${label}"` : label;

                    // Inferir cardinalidade a partir do label
                    // "has one", "billing", "shipping" = one-to-one (||--||)
                    // demais casos = one-to-many (||--o{)
                    let leftSide = tag.id;
                    let rightSide = conn.id;
                    let cardinality = '||--o{';

                    if (/^(has.one|billing|shipping)$/i.test(label.trim())) {
                        cardinality = '||--||';
                    }

                    // "references" indica relação child->parent (FK do child aponta pro parent)
                    // Invertemos a direção para mostrar parent->children no diagrama
                    if (/^references$/i.test(label.trim())) {
                        leftSide = conn.id;
                        rightSide = tag.id;
                    }

                    relationships.push(`    ${leftSide} ${cardinality} ${rightSide} : ${formattedLabel}`);
                }
            }
        }

        // Gera o Mermaid
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