//@::graph TD

import * as vscode from 'vscode';

/**
 * Hover Provider for MAD tags.
 * Renders Mermaid diagrams inline on hover over MAD tagged lines.
 */
//@MADHoverProvider
export class MADHoverProvider implements vscode.HoverProvider {
    //@MADHoverProvider1:Check for MAD tag on the hovered line
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const line = document.lineAt(position.line);
        const lineText = line.text;

        //@MADHoverProvider1->MADHoverProvider2:Match //@ tag pattern on the line
        //@MADHoverProvider2:MAD tag found — extract ID and description
        const match = lineText.match(/\/\/\s*@([\w.]+)(?::([^\n]+))?/);
        if (!match) return null;
        if (match[1].startsWith('::')) return null;

        //@MADHoverProvider2->MADHoverProvider3:Build hover Markdown content
        //@MADHoverProvider3:Hover Markdown rendered and returned
        const tagId = match[1];
        const description = match[2]?.trim() || tagId;

        const contents = new vscode.MarkdownString();
        contents.appendMarkdown(`**MAD Tag: \`${tagId}\`**\n\n`);
        contents.appendMarkdown(`${description}\n\n`);
        contents.appendMarkdown(`---\n`);
        contents.appendMarkdown(`*Click the gutter icon to view the full diagram.*`);
        contents.isTrusted = true;

        return new vscode.Hover(contents, line.range);
    }
}