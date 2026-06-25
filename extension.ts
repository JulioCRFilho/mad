import * as vscode from 'vscode';

/**
 * Utilitário para transformar nomes camelCase/snake_case em labels legíveis
 */
function toReadableLabel(name: string): string {
    // Remove prefixos de underscore
    let cleaned = name.replace(/^_+/, '');
    
    // Insere espaço antes de letras maiúsculas (camelCase)
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Substitui underscores e hífens por espaços (snake_case/kebab-case)
    cleaned = cleaned.replace(/[_-]+/g, ' ');
    
    // Capitaliza primeira letra de cada palavra
    cleaned = cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
    
    // Remove espaços extras
    cleaned = cleaned.trim().replace(/\s+/g, ' ');
    
    return cleaned;
}

/**
 * Extrai o identificador da linha imediatamente abaixo do comentário
 */
function extractIdentifierBelow(lineText: string): string | null {
    // Remove comentários de linha (//, #, --, etc)
    let code = lineText.replace(/^\s*\/\/.*$/, '').replace(/^\s*#.*$/, '').replace(/^\s*--.*$/, '');
    
    // Padrão para capturar identificadores: letras, números, underscore
    const match = code.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[\(\)\[\]\{\}:=,;]?/);
    
    if (match && match[1]) {
        return match[1];
    }
    
    return null;
}

/**
 * Escaneia o documento para encontrar todas as tags //@ com o mesmo prefixo
 */
function findRelatedTags(document: vscode.TextDocument, prefix: string): Array<{line: number, id: string, label: string}> {
    const relatedTags: Array<{line: number, id: string, label: string}> = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const tagMatch = line.match(/\/\/@(\w+)/);
        
        if (tagMatch) {
            const fullId = tagMatch[1];
            const tagPrefix = fullId.split(/[0-9]/)[0]; // Extrai prefixo antes dos números
            
            if (tagPrefix.toLowerCase() === prefix.toLowerCase()) {
                // Tenta extrair identificador na linha abaixo
                let identifier: string | null = null;
                if (i + 1 < lines.length) {
                    identifier = extractIdentifierBelow(lines[i + 1]);
                }
                
                const label = identifier ? toReadableLabel(identifier) : fullId;
                
                relatedTags.push({
                    line: i,
                    id: fullId,
                    label: label
                });
            }
        }
    }
    
    return relatedTags;
}

/**
 * Gera o código Mermaid graph TD baseado nas tags relacionadas
 */
function generateMermaidDiagram(tags: Array<{line: number, id: string, label: string}>): string {
    if (tags.length === 0) {
        return '```mermaid\ngraph TD\n    A[Nenhuma tag relacionada encontrada]\n```';
    }
    
    // Ordena por número do ID para manter ordem hierárquica
    const sorted = [...tags].sort((a, b) => {
        const numA = parseInt(a.id.match(/\d+/)![0]) || 0;
        const numB = parseInt(b.id.match(/\d+/)![0]) || 0;
        return numA - numB;
    });
    
    let mermaid = '```mermaid\ngraph TD\n';
    
    // Cria nós e conexões hierárquicas
    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const nodeId = `N${i}`;
        const safeLabel = current.label.replace(/"/g, '"');
        
        mermaid += `    ${nodeId}["${safeLabel}"]\n`;
        
        // Conecta ao anterior (hierarquia linear)
        if (i > 0) {
            const prevNode = `N${i - 1}`;
            mermaid += `    ${prevNode} --> ${nodeId}\n`;
        }
    }
    
    mermaid += '```';
    
    return mermaid;
}

/**
 * Hover Provider para comentários //@ID
 */
class MDDDHoverProvider implements vscode.HoverProvider {
    
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        
        const line = document.lineAt(position.line);
        const lineText = line.text;
        
        // Verifica se a linha contém uma tag //@
        const tagMatch = lineText.match(/\/\/@(\w+)/);
        
        if (!tagMatch) {
            return null;
        }
        
        const fullId = tagMatch[1];
        const prefix = fullId.split(/[0-9]/)[0];
        
        // Encontra todas as tags relacionadas
        const relatedTags = findRelatedTags(document, prefix);
        
        if (relatedTags.length === 0) {
            return null;
        }
        
        // Gera diagrama Mermaid
        const mermaidCode = generateMermaidDiagram(relatedTags);
        
        // Cria conteúdo do hover
        const hoverContent = new vscode.MarkdownString();
        hoverContent.isTrusted = true;
        hoverContent.appendMarkdown(`**Tag:** \`//@${fullId}\`\n\n`);
        hoverContent.appendMarkdown(`**Prefixo:** \`${prefix}\`\n\n`);
        hoverContent.appendMarkdown(`**Tags relacionadas:** ${relatedTags.length}\n\n`);
        hoverContent.appendMarkdown('---\n\n');
        hoverContent.appendMarkdown(mermaidCode);
        
        // Aplica hover na linha do comentário
        const hoverRange = new vscode.Range(
            position.line,
            0,
            position.line,
            lineText.length
        );
        
        return new vscode.Hover(hoverContent, hoverRange);
    }
}

/**
 * Ativa a extensão
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('MDDD Hover Extension está ativa');
    
    // Registra o HoverProvider para todas as linguagens
    const hoverProvider = vscode.languages.registerHoverProvider(
        { scheme: 'file', language: '*' },
        new MDDDHoverProvider()
    );
    
    context.subscriptions.push(hoverProvider);
}

/**
 * Desativa a extensão
 */
export function deactivate() {
    console.log('MDDD Hover Extension foi desativada');
}