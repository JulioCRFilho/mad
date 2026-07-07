//@::graph TD

import { ProcessedNode } from '../parser';

/**
 * Interface for diagram generators.
 */
export interface DiagramGenerator {
    type: string;
    matches(diagramType: string): boolean;
    generate(tags: ProcessedNode[], diagramType: string): string;
}

/**
 * Extracts sequential numbers from an ID.
 * Used by flowchart generator to sort nodes by numeric ID.
 */
//@extractNumbersFromId
export function extractNumbersFromId(id: string): number[] {
    //@extractNumbersFromId1:Match all digit sequences in the ID
    const matches = id.match(/(\d+)/g);
    //@extractNumbersFromId1->extractNumbersFromId2:Parse matches to numbers and return
    //@extractNumbersFromId2:Number array returned
    return matches ? matches.map(Number) : [];
}