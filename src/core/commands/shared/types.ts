import * as vscode from 'vscode';

export interface DiagramCommandContext {
    document: vscode.TextDocument;
    prefix: string;
    extensionUri: vscode.Uri;
}

export interface DiagramResult {
    success: boolean;
    errorMessage?: string;
}

/**
 * Interface que todo command de diagrama deve implementar.
 * Cada tipo de diagrama (flowchart, sequence, class, state, er)
 * tem sua própria implementação com validação Mermaid específica.
 */
export interface DiagramCommandHandler {
    /** Identificador único do tipo de diagrama */
    type: string;
    /** Verifica se este handler atende ao diagramType informado */
    matches(diagramType: string): boolean;
    /** Executa o pipeline completo: validação, processamento e exibição */
    execute(context: DiagramCommandContext): DiagramResult;
}