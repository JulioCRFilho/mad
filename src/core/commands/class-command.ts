import { BaseDiagramCommand } from './shared/base-command';

/**
 * Command handler para diagramas do tipo Class Diagram.
 * Suporta: classDiagram
 */
export class ClassCommand extends BaseDiagramCommand {
    readonly type = 'class';

    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('classdiagram');
    }
}