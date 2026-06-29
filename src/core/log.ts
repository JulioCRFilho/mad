import * as vscode from 'vscode';

let _outputChannel: vscode.OutputChannel | null = null;

export function getOutputChannel(): vscode.OutputChannel {
    if (!_outputChannel) {
        _outputChannel = vscode.window.createOutputChannel('MAD - Mermaid Auto-Doccing');
    }
    return _outputChannel;
}

export const log = {
    info: (msg: string) => {
        const timestamp = new Date().toISOString().split('T')[0];
        console.log(`[MAD ${timestamp}] ${msg}`);
        getOutputChannel().appendLine(`[${timestamp}] ${msg}`);
    },
    error: (msg: string) => {
        console.error(`[MAD ERROR] ${msg}`);
        getOutputChannel().appendLine(`ERROR: ${msg}`);
        getOutputChannel().show();
    },
    warn: (msg: string) => {
        console.warn(`[MAD WARN] ${msg}`);
        getOutputChannel().appendLine(`WARN: ${msg}`);
    }
};