/**
 * PONTO DE ENTRADA para comandos de diagrama.
 *
 * Este módulo unifica todos os handlers específicos de diagrama
 * e exporta uma função `validateAndDisplayDiagram` que delega
 * para o handler correto baseado no tipo de diagrama lido do arquivo.
 *
 * Cada tipo de diagrama tem seu próprio arquivo:
 * - flowchart-command.ts
 * - sequence-command.ts
 * - class-command.ts
 * - state-command.ts
 * - er-command.ts
 *
 * Para adicionar um novo tipo:
 * 1. Crie um arquivo estendendo BaseDiagramCommand
 * 2. Implemente matches() para identificar o tipo de diagrama
 * 3. Registre no array handlers abaixo
 * 4. Pronto! O dispatcher fará o roteamento automaticamente
 */

import { DiagramCommandHandler, DiagramCommandContext, DiagramResult } from './shared/types';
import { FlowchartCommand } from './flowchart-command';
import { SequenceCommand } from './sequence-command';
import { ClassCommand } from './class-command';
import { StateCommand } from './state-command';
import { ERCommand } from './er-command';

export type { DiagramCommandContext, DiagramResult, DiagramCommandHandler };

/** Lista de todos os handlers de comando registrados */
const handlers: DiagramCommandHandler[] = [
    new FlowchartCommand(),
    new SequenceCommand(),
    new ClassCommand(),
    new StateCommand(),
    new ERCommand(),
];

/**
 * Registra um novo handler dinamicamente.
 * Útil para plugins ou extensões.
 */
export function registerCommandHandler(handler: DiagramCommandHandler): void {
    handlers.push(handler);
}

/**
 * Obtém o handler adequado para o tipo de diagrama informado.
 */
export function getHandler(diagramType: string): DiagramCommandHandler {
    for (const handler of handlers) {
        if (handler.matches(diagramType)) return handler;
    }
    // Fallback para flowchart
    return handlers[0];
}

/**
 * Valida e exibe o diagrama, retornando mensagem de erro se inválido.
 *
 * Esta função substitui a original validateAndDisplayDiagram em diagram-command.ts.
 * Ela lê o tipo de diagrama da primeira linha do arquivo e delega
 * para o handler específico.
 */
export function validateAndDisplayDiagram(context: DiagramCommandContext): DiagramResult {
    const { document } = context;

    // Lê o tipo de diagrama da primeira linha
    const firstLine = document.getText().split(/\r?\n/)[0] || '';
    const match = firstLine.match(/\/\/@::(.+)/);
    const diagramType = match ? match[1].trim() : 'flowchart TD';

    // Obtém o handler adequado e executa
    const handler = getHandler(diagramType);
    return handler.execute(context);
}

// Re-exporta classes individuais para uso direto quando necessário
export { FlowchartCommand } from './flowchart-command';
export { SequenceCommand } from './sequence-command';
export { ClassCommand } from './class-command';
export { StateCommand } from './state-command';
export { ERCommand } from './er-command';