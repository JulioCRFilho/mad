//@::classDiagram

//@BaseDiagramCommand
import { BaseDiagramCommand } from './shared/base-command';

/**
 * Command handler for Flowchart / Graph diagrams.
 * Supports: flowchart TD, flowchart LR, graph TD, graph LR, etc.
 */
//@FlowchartCommand
export class FlowchartCommand extends BaseDiagramCommand {
    //@FlowchartCommand<|--BaseDiagramCommand:inherits
    //@FlowchartCommand1:type property
    readonly type = 'flowchart';

    //@FlowchartCommand1.1:matches method
    matches(diagramType: string): boolean {
        const key = diagramType.toLowerCase();
        return key.startsWith('flowchart') || key.startsWith('graph');
    }
}