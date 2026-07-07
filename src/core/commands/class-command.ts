//@::classDiagram

//@BaseDiagramCommand
import { BaseDiagramCommand } from './shared/base-command';

/**
 * Command handler for Class Diagram type.
 * Supports: classDiagram
 */
//@ClassCommand
export class ClassCommand extends BaseDiagramCommand {
    //@ClassCommand<|--BaseDiagramCommand:inherits
    //@ClassCommand1:type property
    readonly type = 'class';

    //@ClassCommand1.1:matches method
    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('classdiagram');
    }
}