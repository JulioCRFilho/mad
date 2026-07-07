//@::classDiagram

/**
 * DIAGRAM COMMAND - Main entry point (backward compatibility).
 *
 * This file has been refactored into multiple specific modules:
 *
 *   commands/
 *     index.ts              ← Main dispatcher and factory
 *     flowchart-command.ts  ← Handler for Flowchart/Graph
 *     sequence-command.ts   ← Handler for Sequence Diagram
 *     class-command.ts      ← Handler for Class Diagram
 *     state-command.ts      ← Handler for State Diagram
 *     er-command.ts         ← Handler for ER Diagram
 *     shared/
 *       types.ts            ← Shared interfaces and types
 *       helpers.ts          ← Helper functions (processRetroPointers, processForwardPointers, etc.)
 *       validation.ts       ← MAD and Mermaid validation by type
 *       base-command.ts     ← Abstract base class for all handlers
 *
 * The validateAndDisplayDiagram() function is now a dispatcher that
 * automatically delegates to the correct handler based on the diagram
 * type read from the first line of the file.
 *
 * To add a new diagram type:
 * 1. Create a handler extending BaseDiagramCommand in commands/
 * 2. Implement matches() to identify your type
 * 3. Register it in the array in commands/index.ts
 */

//@DiagramCommandModule
export {
    //@DiagramCommandModule1:Re-export validateAndDisplayDiagram
    validateAndDisplayDiagram,
    //@DiagramCommandModule1.1:Re-export generateDiagram
    generateDiagram,
    //@DiagramCommandModule1.2:Re-export registerCommandHandler
    registerCommandHandler,
    //@DiagramCommandModule1.3:Re-export getHandler
    getHandler,
    //@DiagramCommandModule1.4:Re-export FlowchartCommand
    FlowchartCommand,
    //@DiagramCommandModule1.5:Re-export SequenceCommand
    SequenceCommand,
    //@DiagramCommandModule1.6:Re-export ClassCommand
    ClassCommand,
    //@DiagramCommandModule1.7:Re-export StateCommand
    StateCommand,
    //@DiagramCommandModule1.8:Re-export ERCommand
    ERCommand,
} from './index';

//@DiagramCommandModule2:Re-export types
export type {
    DiagramCommandContext,
    DiagramResult,
    DiagramCommandHandler,
} from './shared/types';