//@::graph TD

import * as vscode from 'vscode';

/**
 * Manages gutter decorations for MAD tags.
 * Shows icons in the gutter for lines containing //@ tags.
 */
//@MADDecorationManager
export class MADDecorationManager {
    private iconPath: string;
    private decorationType: vscode.TextEditorDecorationType;

    constructor(iconPath: string) {
        this.iconPath = iconPath;
        this.decorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: vscode.Uri.file(iconPath),
            gutterIconSize: 'contain',
        });
    }

    //@MADDecorationManager1:Scan document lines and build decoration options
    provideDecorations(document: vscode.TextDocument): vscode.DecorationOptions[] {
        const decorations: vscode.DecorationOptions[] = [];
        const text = document.getText();
        const lines = text.split(/\r?\n/);

        //@MADDecorationManager1->MADDecorationManager2:Iterate lines to match //@ tags
        //@MADDecorationManager2:Matching lines collected as decorations
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/\/\/\s*@([\w.]+)/);
            if (match) {
                decorations.push({
                    range: new vscode.Range(i, 0, i, 0),
                    hoverMessage: `MAD Tag: ${match[1]}`
                });
            }
        }

        return decorations;
    }

    //@MADDecorationManager2->MADDecorationManager3:Apply decorations to editor
    //@MADDecorationManager3:Decorations applied to gutter
    apply(editor: vscode.TextEditor, decorations: vscode.DecorationOptions[]): void {
        editor.setDecorations(this.decorationType, decorations);
    }

    dispose() {
        this.decorationType.dispose();
    }
}