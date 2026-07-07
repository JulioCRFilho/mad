//@::classDiagram

/**
 * ENTRY POINT for diagram commands.
 *
 * This module unifies all specific diagram handlers
 * and exports a `validateAndDisplayDiagram` function that delegates
 * to the correct handler based on the diagram type read from the file.
 *
 * Each diagram type has its own file:
 * - flowchart-command.ts
 * - sequence-command.ts
 * - class-command.ts
 * - state-command.ts
 * - er-command.ts
 *
 * To add a new type:
 * 1. Create a file extending BaseDiagramCommand
 * 2. Implement matches() to identify the diagram type
 * 3. Register it in the handlers array below
 * 4. Done! The dispatcher will route automatically
 */

//@DiagramCommandHandler
import { DiagramCommandHandler, DiagramCommandContext, DiagramResult } from './shared/types';
//@FlowchartCommand
import { FlowchartCommand } from './flowchart-command';
//@SequenceCommand
import { SequenceCommand } from './sequence-command';
//@ClassCommand
import { ClassCommand } from './class-command';
//@StateCommand
import { StateCommand } from './state-command';
//@ERCommand
import { ERCommand } from './er-command';

export type { DiagramCommandContext, DiagramResult, DiagramCommandHandler };

/** List of all registered command handlers */
//@HandlersRegistry
const handlers: DiagramCommandHandler[] = [
    //@HandlersRegistry1:Instantiate FlowchartCommand
    new FlowchartCommand(),
    //@HandlersRegistry1.1:Instantiate SequenceCommand
    new SequenceCommand(),
    //@HandlersRegistry1.2:Instantiate ClassCommand
    new ClassCommand(),
    //@HandlersRegistry1.3:Instantiate StateCommand
    new StateCommand(),
    //@HandlersRegistry1.4:Instantiate ERCommand
    new ERCommand(),
];

/**
 * Registers a new handler dynamically.
 * Useful for plugins or extensions.
 */
//@registerCommandHandler
export function registerCommandHandler(handler: DiagramCommandHandler): void {
    //@registerCommandHandler1:Push handler to array
    handlers.push(handler);
}

/**
 * Gets the appropriate handler for the given diagram type.
 */
//@getHandler
export function getHandler(diagramType: string): DiagramCommandHandler {
    //@getHandler1:Iterate handlers
    for (const handler of handlers) {
        //@->FlowchartCommand:Return first match
        if (handler.matches(diagramType)) return handler;
    }
    //@->FlowchartCommand:Fallback to flowchart
    return handlers[0];
}

/**
 * Validates and displays the diagram, returning an error message if invalid.
 *
 * This function replaces the original validateAndDisplayDiagram in diagram-command.ts.
 * It reads the diagram type from the first line of the file and delegates
 * to the specific handler.
 */
//@validateAndDisplayDiagram
export function validateAndDisplayDiagram(context: DiagramCommandContext): DiagramResult {
    const { document } = context;

    //@validateAndDisplayDiagram1:Parse diagram type from document
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    let tagMatch: RegExpMatchArray | null = null;
    
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/\/\/\s*@::(.+)/);
        if (match) {
            tagMatch = match;
            break;
        }
    }
    
    const diagramType = tagMatch ? tagMatch[1].trim() : 'flowchart TD';

    //@validateAndDisplayDiagram1.1:Delegate to handler
    const handler = getHandler(diagramType);
    return handler.execute(context);
}

/**
 * Generates the diagram code without displaying it.
 * Returns the Mermaid code for AI agent validation.
 * Uses the same pipeline as validateAndDisplayDiagram to avoid divergence.
 */
//@generateDiagram
export function generateDiagram(context: DiagramCommandContext): DiagramResult & { code?: string } {
    const { document } = context;

    //@generateDiagram1:Parse diagram type from document
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    let tagMatch: RegExpMatchArray | null = null;
    
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/\/\/\s*@::(.+)/);
        if (match) {
            tagMatch = match;
            break;
        }
    }
    
    const diagramType = tagMatch ? tagMatch[1].trim() : 'flowchart TD';

    //@generateDiagram1.1:Delegate to handler generateOnly
    const handler = getHandler(diagramType);
    return handler.generateOnly(context);
}

// Re-exports individual classes for direct use when needed
export { FlowchartCommand } from './flowchart-command';
export { SequenceCommand } from './sequence-command';
export { ClassCommand } from './class-command';
export { StateCommand } from './state-command';
export { ERCommand } from './er-command';