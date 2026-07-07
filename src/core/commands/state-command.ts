//@::classDiagram

//@BaseDiagramCommand
import { BaseDiagramCommand } from './shared/base-command';

/**
 * Command handler for State Diagram type.
 * Supports: stateDiagram, stateDiagram-v2
 */
//@StateCommand
export class StateCommand extends BaseDiagramCommand {
    //@StateCommand<|--BaseDiagramCommand:inherits
    //@StateCommand1:type property
    readonly type = 'state';

    //@StateCommand1.1:matches method
    matches(diagramType: string): boolean {
        const key = diagramType.toLowerCase();
        return key.startsWith('statediagram') || key.includes('state');
    }
}