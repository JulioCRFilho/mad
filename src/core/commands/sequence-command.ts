import { BaseDiagramCommand } from './shared/base-command';

/**
 * Command handler para diagramas do tipo Sequence Diagram.
 * Suporta: sequenceDiagram
 */
export class SequenceCommand extends BaseDiagramCommand {
    readonly type = 'sequence';

    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('sequencediagram');
    }
}