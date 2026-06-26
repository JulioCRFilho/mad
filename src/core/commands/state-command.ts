import { BaseDiagramCommand } from './shared/base-command';

/**
 * Command handler para diagramas do tipo State Diagram.
 * Suporta: stateDiagram, stateDiagram-v2
 */
export class StateCommand extends BaseDiagramCommand {
    readonly type = 'state';

    matches(diagramType: string): boolean {
        const key = diagramType.toLowerCase();
        return key.startsWith('statediagram') || key.includes('state');
    }
}