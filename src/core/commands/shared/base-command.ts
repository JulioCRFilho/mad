//@::graph

import * as vscode from 'vscode';
import { readDiagramType, ProcessedNode } from '../../diagram/parser';
import { generateMermaidDiagram } from '../../diagram/generator';
import { MADDiagramPanel } from '../../ui/diagram-panel';
import { DiagramCommandContext, DiagramResult, DiagramCommandHandler } from './types';
import { findRelatedTags } from './helpers';
import { validateMADStructure, validateMermaidForType } from './validation';

/**
 * Abstract base class for all diagram commands.
 * Implements the common pipeline: MAD validation → tag processing → Mermaid generation → Mermaid validation → display.
 * Each diagram type only needs to implement `matches()` and can override methods for specific behavior.
 */
//@BaseDiagramCommand
export abstract class BaseDiagramCommand implements DiagramCommandHandler {
    abstract readonly type: string;
    abstract matches(diagramType: string): boolean;

    /**
     * Reads the diagram type from the first line of the file
     */
    protected readDiagramType(document: vscode.TextDocument): string {
        return readDiagramType(document);
    }

    /**
     * Validates the MAD diagram structure (hierarchy rules, references, etc.)
     */
    protected validateMAD(document: vscode.TextDocument, prefix: string): { valid: boolean; error?: string } {
        const result = validateMADStructure(document, prefix);
        if (!result.valid) {
            const errorMessages = result.errors.map(e =>
                `Line ${e.line + 1}: ${e.message}`
            ).join('\n');
            return { valid: false, error: `Diagram error:\n${errorMessages}` };
        }
        return { valid: true };
    }

    /**
     * Finds and processes all tags related to the diagram.
     */
    protected findTags(document: vscode.TextDocument, prefix: string, diagramType: string): ProcessedNode[] {
        return findRelatedTags(document, prefix, diagramType);
    }

    /**
     * Generates the Mermaid code from the processed tags
     */
    protected generateMermaid(tags: ProcessedNode[], diagramType: string): string {
        return generateMermaidDiagram(tags, diagramType);
    }

    /**
     * Validates the Mermaid syntax using the real Mermaid parser (mermaid.parse).
     */
    protected validateMermaid(mermaidCode: string, diagramType: string): { valid: boolean; error?: string } {
        return validateMermaidForType(mermaidCode, diagramType);
    }

    /**
     * Displays the diagram in the webview panel
     */
    protected displayDiagram(extensionUri: vscode.Uri, mermaidCode: string): void {
        MADDiagramPanel.createOrShow(extensionUri, mermaidCode);
    }

    /**
     * Hook executed before MAD validation.
     */
    protected beforeValidation(_document: vscode.TextDocument, _prefix: string): void {
    }

    /**
     * Hook executed before diagram display.
     */
    protected beforeDisplay(_mermaidCode: string, _diagramType: string): string {
        return _mermaidCode;
    }

    /**
     * Executes the complete diagram pipeline.
     * Flow: read diagram type → beforeValidation → validateMAD → findTags →
     *   generateMermaid → beforeDisplay → validateMermaid → displayDiagram
     */
    //@BaseDiagramCommand1:Execute pipeline — display diagram
    execute(context: DiagramCommandContext): DiagramResult {
        const { document, prefix, extensionUri } = context;

        // Step 1: Read diagram type
        //@BaseDiagramCommand1.1:Diagram type read from document
        const diagramType = this.readDiagramType(document);

        // Step 2: Pre-validation hook
        this.beforeValidation(document, prefix);

        // Step 3: Validate MAD structure
        //@BaseDiagramCommand1.1->BaseDiagramCommand1.2:Validate MAD structure
        //@BaseDiagramCommand1.2:MAD structure validated
        const validation = this.validateMAD(document, prefix);
        if (!validation.valid) {
            //@BaseDiagramCommand1.2->Ext_1:MAD validation failed
            return { success: false, errorMessage: validation.error };
        }

        // Step 4: Find and process related tags
        //@BaseDiagramCommand1.2->BaseDiagramCommand1.3:Find and process tags
        //@BaseDiagramCommand1.3:Tags found and processed
        const relatedTags = this.findTags(document, prefix, diagramType);

        // Step 5: Generate Mermaid code
        //@BaseDiagramCommand1.3->BaseDiagramCommand1.4:Generate Mermaid code
        //@BaseDiagramCommand1.4:Mermaid code generated
        let mermaidCode = this.generateMermaid(relatedTags, diagramType);

        // Step 6: Pre-display hook
        mermaidCode = this.beforeDisplay(mermaidCode, diagramType);

        // Step 7: Validate Mermaid syntax
        //@BaseDiagramCommand1.4->BaseDiagramCommand1.5:Validate Mermaid syntax
        //@BaseDiagramCommand1.5:Mermaid syntax validated
        const mermaidValidation = this.validateMermaid(mermaidCode, diagramType);
        if (!mermaidValidation.valid) {
            //@BaseDiagramCommand1.5->Ext_1:Mermaid validation failed
            return {
                success: false,
                errorMessage: `Mermaid syntax error:\n${mermaidValidation.error}`
            };
        }

        // Step 8: Display diagram
        //@BaseDiagramCommand1.5->BaseDiagramCommand1.6:Display diagram in panel
        //@BaseDiagramCommand1.6:Diagram displayed to user
        this.displayDiagram(extensionUri, mermaidCode);

        return { success: true };
    }

    /**
     * Generates the diagram without displaying it.
     * Uses the EXACT same pipeline as execute() but returns Mermaid code instead of displaying.
     */
    //@BaseDiagramCommand2:Generate-only pipeline — return Mermaid code
    generateOnly(context: DiagramCommandContext): DiagramResult & { code?: string } {
        const { document, prefix } = context;

        // Step 1: Read diagram type
        //@BaseDiagramCommand2.1:Diagram type read from document
        const diagramType = this.readDiagramType(document);

        // Step 2: Pre-validation hook
        this.beforeValidation(document, prefix);

        // Step 3: Validate MAD structure
        //@BaseDiagramCommand2.1->BaseDiagramCommand2.2:Validate MAD structure
        //@BaseDiagramCommand2.2:MAD structure validated
        const validation = this.validateMAD(document, prefix);
        if (!validation.valid) {
            //@BaseDiagramCommand2.2->Ext_1:MAD validation failed
            return { success: false, errorMessage: validation.error };
        }

        // Step 4: Find and process related tags
        //@BaseDiagramCommand2.2->BaseDiagramCommand2.3:Find and process tags
        //@BaseDiagramCommand2.3:Tags found and processed
        const relatedTags = this.findTags(document, prefix, diagramType);

        // Step 5: Generate Mermaid code
        //@BaseDiagramCommand2.3->BaseDiagramCommand2.4:Generate Mermaid code
        //@BaseDiagramCommand2.4:Mermaid code generated
        let mermaidCode = this.generateMermaid(relatedTags, diagramType);

        // Step 6: Pre-display hook
        mermaidCode = this.beforeDisplay(mermaidCode, diagramType);

        // Step 7: Validate Mermaid syntax
        //@BaseDiagramCommand2.4->BaseDiagramCommand2.5:Validate Mermaid syntax
        //@BaseDiagramCommand2.5:Mermaid syntax validated
        const mermaidValidation = this.validateMermaid(mermaidCode, diagramType);
        if (!mermaidValidation.valid) {
            //@BaseDiagramCommand2.5->Ext_1:Mermaid validation failed
            return {
                success: false,
                errorMessage: `Mermaid syntax error:\n${mermaidValidation.error}`
            };
        }

        //@BaseDiagramCommand2.5->BaseDiagramCommand2.6:Return Mermaid code to caller
        //@BaseDiagramCommand2.6:Mermaid code returned (no display)
        return { success: true, code: mermaidCode };
    }
}