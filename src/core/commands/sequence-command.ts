//@::graph TD

import { BaseDiagramCommand } from './shared/base-command';
import { DiagramCommandContext, DiagramResult } from './shared/types';
import { findRelatedTagsWithOrder } from './shared/helpers';
import { generateMermaidDiagram } from '../diagram/generator';

/**
 * Command handler for Sequence Diagram type.
 * Supports: sequenceDiagram
 *
 * Overrides execute() to use findRelatedTagsWithOrder instead of findRelatedTags,
 * ensuring direct connection arrows are merged into ProcessedNode.connections
 * in declaration order so the sequenceGenerator can build correctly-ordered message groups.
 */
//@SequenceCommand
export class SequenceCommand extends BaseDiagramCommand {
    //@SequenceCommand<|--BaseDiagramCommand:inherits BaseDiagramCommand

    readonly type = 'sequence';

    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('sequencediagram');
    }

    /**
     * Overrides execute() to use findRelatedTagsWithOrder instead of the base
     * class's findRelatedTags, ensuring direct connection arrows are merged into
     * ProcessedNode.connections in declaration order for the sequence generator.
     *
     * Pipeline: read type → beforeValidation → validateMAD → findTags (ordered) →
     *   generateMermaid → beforeDisplay → validateMermaid → displayDiagram
     */
    //@SequenceCommand1:Pipeline entry — execute() called
    execute(context: DiagramCommandContext): DiagramResult {
        const { document, prefix, extensionUri } = context;

        //@SequenceCommand1.1:Read diagram type from document
        const diagramType = this.readDiagramType(document);

        //@SequenceCommand1.1->SequenceCommand1.2:Run beforeValidation hook
        this.beforeValidation(document, prefix);

        // Step 1: Validate MAD structure
        //@SequenceCommand1.1->SequenceCommand1.3:Validate MAD structure
        //@SequenceCommand1.3:MAD structure validated
        const validation = this.validateMAD(document, prefix);
        if (!validation.valid) {
            //@SequenceCommand1.3->Ext_1:Invalid MAD — return error
            return { success: false, errorMessage: validation.error };
        }

        // Step 2: Find tags using ordered variant (KEY DIFFERENCE from base class)
        //@SequenceCommand1.3->SequenceCommand1.4:Find tags with ordered connections
        //@SequenceCommand1.4:Tags found (ordered-connection variant)
        const relatedTags = this.findTags(document, prefix, diagramType);

        // Step 3: Generate Mermaid code
        //@SequenceCommand1.4->SequenceCommand1.5:Generate Mermaid code
        //@SequenceCommand1.5:Mermaid code generated
        const mermaidCode = this.generateMermaid(relatedTags, diagramType);

        // Step 4: Apply pre-display hook
        //@SequenceCommand1.5->SequenceCommand1.6:Apply beforeDisplay hook
        //@SequenceCommand1.6:Pre-display hook applied
        const processedCode = this.beforeDisplay(mermaidCode, diagramType);

        // Step 5: Validate Mermaid syntax
        //@SequenceCommand1.6->SequenceCommand1.7:Validate Mermaid syntax
        //@SequenceCommand1.7:Mermaid syntax validated
        const mermaidValidation = this.validateMermaid(processedCode, diagramType);
        if (!mermaidValidation.valid) {
            //@SequenceCommand1.7->Ext_1:Invalid Mermaid — return error
            return {
                success: false,
                errorMessage: `Mermaid syntax error:\n${mermaidValidation.error}`
            };
        }

        // Step 6: Display diagram in panel
        //@SequenceCommand1.7->SequenceCommand1.8:Display diagram in panel
        //@SequenceCommand1.8:Diagram displayed to user
        this.displayDiagram(extensionUri, processedCode);

        return { success: true };
    }
}