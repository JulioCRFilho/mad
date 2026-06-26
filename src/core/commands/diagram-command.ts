/**
 * DIAGRAM COMMAND - Ponto de entrada principal (compatibilidade retroativa).
 *
 * Este arquivo foi refatorado em múltiplos módulos específicos:
 *
 *   commands/
 *     index.ts              ← Dispatcher principal e factory
 *     flowchart-command.ts  ← Handler para Flowchart/Graph
 *     sequence-command.ts   ← Handler para Sequence Diagram
 *     class-command.ts      ← Handler para Class Diagram
 *     state-command.ts      ← Handler para State Diagram
 *     er-command.ts         ← Handler para ER Diagram
 *     shared/
 *       types.ts            ← Interfaces e tipos compartilhados
 *       helpers.ts          ← Funções auxiliares (processRetroPointers, processForwardPointers, etc.)
 *       validation.ts       ← Validação MDDD e Mermaid por tipo
 *       base-command.ts     ← Classe abstrata base para todos os handlers
 *
 * A função validateAndDisplayDiagram() agora é um dispatcher que
 * delega automaticamente para o handler correto baseado no tipo
 * de diagrama lido da primeira linha do arquivo.
 *
 * Para adicionar um novo tipo de diagrama:
 * 1. Crie um handler estendendo BaseDiagramCommand em commands/
 * 2. Implemente matches() para identificar seu tipo
 * 3. Registre no array em commands/index.ts
 */

// Re-exporta tudo do novo módulo index.ts para compatibilidade
export {
    validateAndDisplayDiagram,
    registerCommandHandler,
    getHandler,
    FlowchartCommand,
    SequenceCommand,
    ClassCommand,
    StateCommand,
    ERCommand,
} from './index';

export type {
    DiagramCommandContext,
    DiagramResult,
    DiagramCommandHandler,
} from './shared/types';