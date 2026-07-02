import { BaseDiagramCommand } from './shared/base-command';
import { DiagramCommandContext, DiagramResult } from './shared/types';
import { findRelatedTagsWithOrder } from './shared/helpers';
import { generateMermaidDiagram } from '../diagram/generator';

/**
 * Command handler for Sequence Diagram type.
 * Supports: sequenceDiagram
 *
 * Delegates sequence diagram generation to the shared sequenceGenerator
 * (src/core/diagram/generators/sequence.ts), avoiding code duplication.
 */
export class SequenceCommand extends BaseDiagramCommand {
    readonly type = 'sequence';

    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('sequencediagram');
    }

    /**
     * Overrides execute() to use the ordered-connection pipeline
     * (findRelatedTagsWithOrder), which merges direct connections into
     * ProcessedNode[].connections so the sequenceGenerator can build
     * correctly-ordered message groups.
     */
    execute(context: DiagramCommandContext): DiagramResult {
        const { document, prefix, extensionUri } = context;

        const diagramType = this.readDiagramType(document);

        // MAD validation
        const validation = this.validateMAD(document, prefix);
        if (!validation.valid) {
            return { success: false, errorMessage: validation.error };
        }

        // Step 3: Find and process related tags (with order-preserving pipeline for sequence)
        // findRelatedTagsWithOrder also returns orderedDirectConnections; we use the
        // wrapper findRelatedTags (via this.findTags) which merges those connections
        // into nodes so the sequenceGenerator can order them by line.
        const relatedTags = this.findTags(document, prefix, diagramType);

        // Step 4: Generate Mermaid code via shared sequenceGenerator
        const mermaidCode = this.generateMermaid(relatedTags, diagramType);

        // Step 5: Pre-display hook
        const processedCode = this.beforeDisplay(mermaidCode, diagramType);

        // Step 6: Validate Mermaid syntax
        const mermaidValidation = this.validateMermaid(processedCode, diagramType);
        if (!mermaidValidation.valid) {
            return {
                success: false,
                errorMessage: `Mermaid syntax error:\n${mermaidValidation.error}`
            };
        }

        // Step 7: Display diagram
        this.displayDiagram(extensionUri, processedCode);

        return { success: true };
    }
}
