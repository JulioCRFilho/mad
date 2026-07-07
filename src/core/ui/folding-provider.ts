//@::graph TD

import * as vscode from 'vscode';

/**
 * Folding Range Provider for MAD tags.
 * Groups consecutive //@ entries into foldable blocks.
 */
//@MADFoldingProvider
export class MADFoldingProvider implements vscode.FoldingRangeProvider {
    //@MADFoldingProvider1:Provide folding ranges by scanning document lines
    provideFoldingRanges(
        document: vscode.TextDocument,
        _context: vscode.FoldingContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.FoldingRange[]> {
        const ranges: vscode.FoldingRange[] = [];
        const text = document.getText();
        const lines = text.split(/\r?\n/);

        //@MADFoldingProvider1->MADFoldingProvider2:Detect MAD tag groups and track boundaries
        //@MADFoldingProvider2:Tag groups detected — fold ranges built
        let groupStart = -1;
        let currentGroupId = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/\/\/\s*@([\w.]+)/);
            
            if (match && !match[1].startsWith('::')) {
                const groupName = match[1].replace(/\d+$/, '').split('.')[0];
                
                if (groupStart === -1) {
                    groupStart = i;
                    currentGroupId = groupName;
                } else if (groupName !== currentGroupId && i - groupStart > 1) {
                    //@MADFoldingProvider2->MADFoldingProvider3:Flush accumulated group as folding range
                    //@MADFoldingProvider3:Group flushed — folding range emitted
                    ranges.push(new vscode.FoldingRange(groupStart, i - 1));
                    groupStart = i;
                    currentGroupId = groupName;
                }
            } else if (groupStart !== -1) {
                if (i - groupStart > 1) {
                    ranges.push(new vscode.FoldingRange(groupStart, i - 1));
                }
                groupStart = -1;
            }
        }

        //@MADFoldingProvider2->MADFoldingProvider4:Flush trailing group if any
        //@MADFoldingProvider4:All fold ranges returned
        return ranges;
    }
}