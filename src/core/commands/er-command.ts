import { BaseDiagramCommand } from './shared/base-command';

/**
 * Command handler para diagramas do tipo ER (Entity Relationship).
 * Suporta: erDiagram
 *
 * Comportamento específico:
 * - Extrai blocos SQL completos para definir entidades
 * - Usa SQL DDL abaixo dos grupos como definição de entidades
 *
 * O processamento específico de ER (extração de SQL) é feito
 * no helper `processRetroPointers` com isERDiagram=true
 */
export class ERCommand extends BaseDiagramCommand {
    readonly type = 'er';

    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('erdiagram');
    }
}