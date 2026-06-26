import { ProcessedNode } from '../parser';

/**
 * Interface que todo generator de diagrama deve implementar
 */
export interface DiagramGenerator {
    /** Identificador único do tipo de diagrama */
    type: string;
    /** Verifica se este generator atende ao diagramType informado */
    matches(diagramType: string): boolean;
    /** Gera o código Mermaid */
    generate(tags: ProcessedNode[], diagramType: string): string;
}

/**
 * Extrai o(s) número(s) do ID de um nó para ordenação.
 * Ex: "Login1" → [1], "Login1.1" → [1, 1], "Login1.1.2" → [1, 1, 2]
 */
export function extractNumbersFromId(id: string): number[] {
    const match = id.match(/\d+(\.\d+)*/g);
    if (!match) return [0];
    return match[0].split('.').map(Number);
}