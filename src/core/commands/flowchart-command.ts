import { BaseDiagramCommand } from './shared/base-command';

/**
 * Command handler para diagramas do tipo Flowchart / Graph.
 * Suporta: flowchart TD, flowchart LR, graph TD, graph LR, etc.
 */
export class FlowchartCommand extends BaseDiagramCommand {
    readonly type = 'flowchart';

    matches(diagramType: string): boolean {
        const key = diagramType.toLowerCase();
        return key.startsWith('flowchart') || key.startsWith('graph');
    }
}