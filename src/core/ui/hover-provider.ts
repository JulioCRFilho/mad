import * as vscode from 'vscode';
import { filterAllNodes } from '../diagram/parser';

/**
 * HoverProvider que exibe informações detalhadas sobre tags //@ ao passar o mouse.
 * Mostra o ID, label formatado e preview de código abaixo da tag.
 */
export class MDDDHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
        const lineText = document.lineAt(position.line).text;

        // Verifica se a linha tem uma tag //@
        const tagMatch = lineText.match(/\/\/@([\w.]+)(?::([^\n]+))?/);
        if (!tagMatch) return null;

        const fullId = tagMatch[1];
        const description = tagMatch[2]?.trim();

        // Extrai linha de código abaixo da tag (pulando outras tags consecutivas)
        const text = document.getText();
        const lines = text.split(/\r?\n/);
        let codeLine: string | null = null;
        let j = position.line + 1;
        while (j < lines.length && lines[j].match(/\/\/@/)) {
            j++;
        }
        if (j < lines.length) {
            codeLine = lines[j].trim();
        }

        // Determina o tipo da tag
        const isArrow = lineText.includes('//@->');
        const isGroup = !/\d/.test(fullId);
        const isEntry = /^[a-zA-Z_]+[0-9]+$/.test(fullId);
        const isSequence = /\.[0-9]+/.test(fullId);

        // Monta as partes do hover
        const markdownParts: string[] = [];

        // Título
        markdownParts.push(`**🔖 MDDD Tag**`);

        // Tipo da tag
        const tagType = isArrow ? '➡️ Forward Pointer' :
            isGroup ? '📦 Group' :
            isEntry ? '🔤 Entry Node' :
            '🔁 Sequence Node';
        markdownParts.push(`**Tipo:** ${tagType}`);

        // ID da tag
        markdownParts.push(`**ID:** \`${fullId}\``);

        // Descrição inline se existir
        if (description) {
            markdownParts.push(`**Descrição:** ${description}`);
        }

        // Código abaixo da tag
        if (codeLine) {
            const code = codeLine.length > 80 ? codeLine.substring(0, 80) + '...' : codeLine;
            markdownParts.push('');
            markdownParts.push('**Código:**');
            markdownParts.push('```\n' + code + '\n```');
        }

        // Hierarquia para sequence nodes
        if (isSequence) {
            const parts = fullId.split('.');
            const parentId = parts.slice(0, -1).join('.');
            markdownParts.push('');
            markdownParts.push(`**⬆️ Pai:** \`${parentId}\``);
        }

        // Para entry nodes, mostra o grupo
        if (isEntry) {
            const groupMatch = fullId.match(/^([a-zA-Z_]+)\d+$/);
            if (groupMatch) {
                markdownParts.push('');
                markdownParts.push(`**📂 Grupo:** \`${groupMatch[1]}\``);
            }
        }

        // Para forward pointers, mostra o destino
        if (isArrow) {
            markdownParts.push('');
            markdownParts.push(`**🎯 Destino:** \`${fullId}\``);
        }

        // Ação de clique
        markdownParts.push('');
        markdownParts.push('---');
        markdownParts.push('*Clique para abrir o diagrama*');

        return new vscode.Hover(
            new vscode.MarkdownString(markdownParts.join('\n\n')),
            new vscode.Range(position.line, 0, position.line, lineText.length)
        );
    }
}