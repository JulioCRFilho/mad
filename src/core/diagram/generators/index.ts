//@::graph TD

import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';
import { flowchartGenerator } from './flowchart';
import { sequenceGenerator } from './sequence';
import { classGenerator } from './class';
import { stateGenerator } from './state';
import { erGenerator } from './er';

/** List of all registered generators */
const generators: DiagramGenerator[] = [
    flowchartGenerator,
    sequenceGenerator,
    classGenerator,
    stateGenerator,
    erGenerator,
];

/**
 * Registers a new generator dynamically.
 */
export function registerGenerator(generator: DiagramGenerator): void {
    generators.push(generator);
}

/**
 * Gets the appropriate generator for the given diagram type.
 * Iterates generators array and returns first match, falling back to flowchart.
 */
//@getGenerator
export function getGenerator(diagramType: string): DiagramGenerator {
    //@getGenerator1:Iterate generators to find first match
    for (const gen of generators) {
        if (gen.matches(diagramType)) return gen;
    }
    //@getGenerator1->getGenerator2:No match found — fallback to flowchartGenerator
    //@getGenerator2:Fallback returned
    return flowchartGenerator;
}

/**
 * Generates the Mermaid code for the given diagram type and tags.
 * Single entry point used by all diagram commands.
 */
//@generateMermaidDiagram
export function generateMermaidDiagram(tags: ProcessedNode[], diagramType: string = 'flowchart TD'): string {
    //@generateMermaidDiagram1:Check for empty tags — return placeholder
    if (tags.length === 0) {
        return `${diagramType}\n    A[No related tags found]`;
    }
    //@generateMermaidDiagram1->generateMermaidDiagram2:Delegate to matched generator
    //@generateMermaidDiagram2:Mermaid code returned from matched generator
    const generator = getGenerator(diagramType);
    return generator.generate(tags, diagramType);
}