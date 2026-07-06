import * as vscode from 'vscode';
import { MADDecorationManager } from './src/core/ui/decoration-manager';
import { validateAndDisplayDiagram, generateDiagram, DiagramCommandContext } from './src/core/commands/diagram-command';
import { MADHoverProvider } from './src/core/ui/hover-provider';
import { MADDocumentSymbolProvider } from './src/core/ui/document-symbols';
import { MADFoldingProvider } from './src/core/ui/folding-provider';
import { MADDiagramPanel } from './src/core/ui/diagram-panel';
import { filterAllNodes, readDiagramType } from './src/core/diagram/parser';
import { log, getOutputChannel } from './src/core/log';
import { SUPPORTED_LANGUAGES } from './src/core/languages';
import { createSaveHandler, saveToOutputFile } from './src/core/save-handler';
import { startServer, stopServer, getServerPort, isServerRunning } from './src/core/server';

//@::graph TD

const OUTPUT_FILE = vscode.Uri.file('/tmp/mad-diagram.mermaid');

function isMarkdownDocument(document: vscode.TextDocument): boolean {
    return document.languageId === 'markdown';
}

//@Setup
export async function activate(context: vscode.ExtensionContext) {
    //@Setup1:Clear stale diagram file
    //@Setup1->Setup2:File cleared → show toast
    const outputFile = vscode.Uri.file('/tmp/mad-diagram.mermaid');
    try {
        await vscode.workspace.fs.delete(outputFile);
    } catch (error) {
        //@Setup1->Setup1:File missing → ignore
    }

    //@Setup2:Show activation toast
    //@Setup2->Setup3:Toast shown → configure formatter
    vscode.window.showInformationMessage('🚀 MAD activated! Check the Output Channel "MAD - Mermaid Auto-Doccing"', 'OK');

    const iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'icon.png').fsPath;

    //@Setup3:Auto-configure formatter
    //@Setup3->Setup4:Formatter configured → setup decoration
    const configureFormatterForFile = (document: vscode.TextDocument) => {
        if (isMarkdownDocument(document)) return;

        const text = document.getText();
        const hasMADTags = text.includes('//@') || text.includes('// @');
        if (!hasMADTags) return;

        const config = vscode.workspace.getConfiguration('editor');
        const formatOnSave = config.get<boolean>('formatOnSave', false);
        const showWarning = vscode.workspace.getConfiguration('mad').get<boolean>('showFormatWarning', true);

        //@Setup3.1:Show warning → formatOnSave is on
        if (showWarning && formatOnSave) {
            vscode.window.showWarningMessage(
                '⚠️ The auto-formatter is enabled (formatOnSave) and may break MAD tags. ' +
                'Use the "MAD: Configure Auto-Formatter" command to disable it automatically.',
                'Configure Now'
            ).then(selection => {
                if (selection === 'Configure Now') {
                    //@Setup3->Setup3:User chose Configure → open command
                    vscode.commands.executeCommand('mad.configureFormatter');
                }
            });
        }
    };

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            configureFormatterForFile(document);
        })
    );

    if (vscode.window.activeTextEditor) {
        configureFormatterForFile(vscode.window.activeTextEditor.document);
    }

    //@Setup4:Setup decoration manager
    //@Setup4->Setup5:Decoration ready → register commands
    const decorationManager = new MADDecorationManager(iconPath);
    context.subscriptions.push(decorationManager);

    const updateDecorations = (editor: vscode.TextEditor) => {
        const decorations = decorationManager.provideDecorations(editor.document);
        decorationManager.apply(editor, decorations);
    };

    //@Setup5:Register configureFormatter command
    //@Setup5->Setup6:Command registered → register showDiagram
    const configureFormatterCommand = vscode.commands.registerCommand(
        'mad.configureFormatter',
        async () => {
            const config = vscode.workspace.getConfiguration('editor');
            const currentFormatOnSave = config.get<boolean>('formatOnSave', false);

            if (!currentFormatOnSave) {
                vscode.window.showInformationMessage('✅ formatOnSave is already disabled. No action needed.');
                return;
            }

            //@Setup5->Setup5:formatOnSave enabled → confirm
            const choice = await vscode.window.showWarningMessage(
                'This will disable formatOnSave in your workspace to prevent the auto-formatter from breaking MAD tags. Continue?',
                'Yes, disable',
                'Cancel'
            );

            if (choice === 'Yes, disable') {
                await config.update('formatOnSave', false, vscode.ConfigurationTarget.Workspace);
                vscode.window.showInformationMessage('✅ formatOnSave disabled successfully! Your MAD tags are protected.');
            }
        }
    );
    context.subscriptions.push(configureFormatterCommand);

    //@Setup6:Register showDiagram command
    //@Setup6->Setup7:Command registered → register generateDiagram
    const showDiagramCommand = vscode.commands.registerCommand(
        'mad.showDiagram',
        (lineNumber: number) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const document = editor.document;
            const lineText = document.lineAt(lineNumber).text;
            const tagMatch = lineText.match(/\/\/\s*@([\w.]+)/);
            //@Setup6->Setup6:No tag found → return
            if (!tagMatch) return;

            const fullId = tagMatch[1];
            const prefix = fullId.split(/[0-9]/)[0];

            const diagramContext: DiagramCommandContext = {
                document: document,
                prefix: prefix,
                extensionUri: context.extensionUri
            };

            //@Setup6->Setup6:Tag found → validate and display
            const result = validateAndDisplayDiagram(diagramContext);

            //@Setup6->Setup6:Validation failed → show error
            if (!result.success && result.errorMessage) {
                vscode.window.showErrorMessage(result.errorMessage);
            }
        }
    );
    context.subscriptions.push(showDiagramCommand);

    //@Setup7:Register generateDiagram command
    //@Setup7->Setup8:Command registered → register auto-save
    const generateDiagramCommand = vscode.commands.registerCommand(
        'mad.generateDiagram',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                //@Setup7->Setup7:No active editor → return
                vscode.window.showWarningMessage('No active editor.');
                return;
            }

            const document = editor.document;
            const firstLine = document.lineAt(0).text;
            const tagMatch = firstLine.match(/\/\/\s*@::(.+)/);
            if (!tagMatch) {
                //@Setup7->Setup7:No diagram tag → return
                vscode.window.showWarningMessage('File does not contain MAD diagram tag.');
                return;
            }

            const fullId = tagMatch[1];
            const prefix = fullId.split(/[0-9]/)[0];

            const diagramContext: DiagramCommandContext = {
                document: document,
                prefix: prefix,
                extensionUri: context.extensionUri
            };

            const result = generateDiagram(diagramContext);

            if (!result.success) {
                //@Setup7->Setup7:Generation failed → save error
                const errorMsg = result.errorMessage || 'Error generating diagram.';
                vscode.window.showErrorMessage(errorMsg);
                await saveToOutputFile(`ERROR: ${errorMsg}`);
                return;
            }

            //@Setup7->Setup7:Generation ok → write to /tmp
            await saveToOutputFile(result.code || '', document, fullId);
            await context.globalState.update('mad.lastDiagramCode', result.code);
            await context.globalState.update('mad.lastDiagramType', fullId);
        }
    );
    context.subscriptions.push(generateDiagramCommand);

    //@Setup8:Register auto-generate on save
    //@Setup8->Setup9:Auto-save handler ready → register goToLine
    context.subscriptions.push(createSaveHandler(context));

    //@Setup9:Register goToLine command
    //@Setup9->Setup10:Command registered → register showAtCursor
    const goToLineCommand = vscode.commands.registerCommand(
        'mad.goToLine',
        (lineNumber: number) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const line = Math.max(0, Math.min(lineNumber, editor.document.lineCount - 1));
            const targetRange = new vscode.Range(line, 0, line, 0);
            editor.selection = new vscode.Selection(line, 0, line, 0);
            editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenter);
        }
    );
    context.subscriptions.push(goToLineCommand);

    //@Setup10:Register showDiagramAtCursor command
    //@Setup10->Setup11:Command registered → register showLogs
    const showDiagramAtCursorCommand = vscode.commands.registerCommand(
        'mad.showDiagramAtCursor',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const lineNumber = editor.selection.active.line;
            vscode.commands.executeCommand('mad.showDiagram', lineNumber);
        }
    );
    context.subscriptions.push(showDiagramAtCursorCommand);

    //@Setup11:Register showLogs command
    //@Setup11->Setup12:Command registered → register showStats
    const showLogsCommand = vscode.commands.registerCommand(
        'mad.showLogs',
        () => {
            getOutputChannel().show();
            vscode.window.showInformationMessage('📋 MAD extension logs opened!');
        }
    );
    context.subscriptions.push(showLogsCommand);

    //@Setup12:Register showStats command
    //@Setup12->Setup13:Command registered → register hover provider
    const showStatsCommand = vscode.commands.registerCommand(
        'mad.showStats',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const allNodes = filterAllNodes(editor.document);
            const diagramType = readDiagramType(editor.document);

            //@Setup12->Setup12:Data collected → categorize nodes
            const declared = allNodes.filter((n: { isArrow: boolean }) => !n.isArrow);
            const forward = allNodes.filter((n: { isArrow: boolean }) => n.isArrow);
            const groups = declared.filter((n: { id: string }) => !/\d/.test(n.id));
            const entries = declared.filter((n: { id: string }) => /^[a-zA-Z_]+[0-9]+$/.test(n.id));
            const sequences = declared.filter((n: { id: string }) => /\.[0-9]+/.test(n.id));

            const msg = [
                `**📊 MAD Stats**`,
                ``,
                `**Type:** \`${diagramType}\``,
                `**Total tags:** ${allNodes.length}`,
                ``,
                `**Declared:** ${declared.length}`,
                `  ┣ Groups: ${groups.length}`,
                `  ┣ Entry Nodes: ${entries.length}`,
                `  ┗ Sequence Nodes: ${sequences.length}`,
                `**Forward Pointers:** ${forward.length}`,
            ].join('\n');

            vscode.window.showInformationMessage(msg, { modal: false });
        }
    );
    context.subscriptions.push(showStatsCommand);

    //@Setup13:Register hover provider
    //@Setup13->Setup14:Provider registered → register folding
    const hoverProvider = vscode.languages.registerHoverProvider(
        SUPPORTED_LANGUAGES,
        new MADHoverProvider()
    );
    context.subscriptions.push(hoverProvider);

    //@Setup14:Register folding provider
    //@Setup14->Setup15:Provider registered → register fold command
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(
            SUPPORTED_LANGUAGES,
            new MADFoldingProvider()
        )
    );

    //@Setup15:Register foldAllTags command
    //@Setup15->Setup16:Command registered → register unfold command
    const foldAllTagsCommand = vscode.commands.registerCommand(
        'mad.foldAllTags',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            vscode.commands.executeCommand('editor.foldAllMarkerRegions');
        }
    );
    context.subscriptions.push(foldAllTagsCommand);

    //@Setup16:Register unfoldAllTags command
    //@Setup16->Setup17:Command registered → setup auto-fold
    const unfoldAllTagsCommand = vscode.commands.registerCommand(
        'mad.unfoldAllTags',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            vscode.commands.executeCommand('editor.unfoldAllMarkerRegions');
            const fileKey = editor.document.uri.toString();
            unfoldCooldowns.set(fileKey, Date.now() + 5 * 60 * 1000);
        }
    );
    context.subscriptions.push(unfoldAllTagsCommand);

    //@Setup17:Setup auto-fold on open
    //@Setup17->Setup18:Auto-fold ready → setup cleanup
    const unfoldCooldowns = new Map<string, number>();

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            if (isMarkdownDocument(document)) return;
            const text = document.getText();
            if (!text.includes('//@') && !text.includes('// @')) return;

            const fileKey = document.uri.toString();
            const cooldownUntil = unfoldCooldowns.get(fileKey);
            //@Setup17->Setup17:Cooldown active → skip
            if (cooldownUntil && Date.now() < cooldownUntil) return;

            setTimeout(() => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document === document) {
                    const cooldown = unfoldCooldowns.get(fileKey);
                    if (!cooldown || Date.now() >= cooldown) {
                        //@Setup17->Setup17:Cooldown expired → fold regions
                        vscode.commands.executeCommand('editor.foldAllMarkerRegions');
                    }
                }
            }, 100);
        })
    );

    //@Setup18:Cleanup stale cooldowns
    //@Setup18->Setup19:Cleanup running → register symbol provider
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, cooldown] of unfoldCooldowns.entries()) {
            if (now > cooldown + 10 * 60 * 1000) {
                unfoldCooldowns.delete(key);
            }
        }
    }, 60 * 1000);
    context.subscriptions.push({ dispose: () => clearInterval(cleanupInterval) });

    //@Setup19:Register document symbol provider
    //@Setup19->Setup20:Provider registered → setup click detection
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            SUPPORTED_LANGUAGES,
            new MADDocumentSymbolProvider()
        )
    );

    //@Setup20:Setup click detection
    //@Setup20->Setup21:Click detection ready → setup change listeners
    let lastClickLine = -1;
    let lastClickTime = 0;
    const CLICK_THROTTLE_MS = 300;

    const clickDetection = vscode.window.onDidChangeTextEditorSelection(event => {
        const editor = event.textEditor;
        if (!editor) return;
        if (isMarkdownDocument(editor.document)) return;
        //@Setup20->Setup20:Panel already open → skip
        if (MADDiagramPanel.currentPanel) return;

        const selection = editor.selection;
        if (!selection.isEmpty || selection.start.line !== selection.end.line) return;

        const currentLine = selection.active.line;
        const now = Date.now();
        //@Setup20->Setup20:Within throttle window → skip
        if (currentLine === lastClickLine && now - lastClickTime < CLICK_THROTTLE_MS) return;

        const lineText = editor.document.lineAt(currentLine).text;
        const tagMatch = lineText.match(/\/\/\s*@([\w.]+)/);
        if (!tagMatch) return;

        const tagText = tagMatch[0];
        const tagStart = lineText.indexOf(tagText);
        const tagEnd = tagStart + tagText.length;
        const cursorPos = selection.active.character;
        //@Setup20->Setup20:Cursor outside tag → return
        if (cursorPos < tagStart || cursorPos > tagEnd) return;

        lastClickLine = currentLine;
        lastClickTime = now;

        //@Setup20->Setup20:Click on tag → open diagram
        updateDecorations(editor);
        vscode.commands.executeCommand('mad.showDiagram', currentLine);
    });
    context.subscriptions.push(clickDetection);

    //@Setup21:Setup change listeners
    //@Setup21->Setup22:Listeners ready → update decorations
    let lastDecorationUpdate = 0;
    const DECORATION_THROTTLE_MS = 100;

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (!editor) return;
        if (isMarkdownDocument(editor.document)) return;
        updateDecorations(editor);
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        if (isMarkdownDocument(editor.document)) return;
        if (event.document !== editor.document) return;

        //@Setup21->Setup21:Within throttle → skip
        const now = Date.now();
        if (now - lastDecorationUpdate < DECORATION_THROTTLE_MS) return;
        lastDecorationUpdate = now;
        updateDecorations(editor);
    }));

    //@Setup22:Update initial decorations
    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor);
    }

    //@Setup23:Start HTTP server for CLI agents
    //@Setup23->Setup24:Server started → register status command
    startServer(context).then(port => {
        if (port !== null) {
            log.info(`MAD HTTP server started on port ${port}`);
        }
    });

    //@Setup24:Register showServerStatus command
    const showServerStatusCommand = vscode.commands.registerCommand(
        'mad.showServerStatus',
        () => {
            if (isServerRunning()) {
                const port = getServerPort();
                vscode.window.showInformationMessage(
                    `🌐 MAD server running on http://127.0.0.1:${port}\n\n` +
                    `Endpoints:\n` +
                    `  GET  /health    — Liveness check\n` +
                    `  POST /validate  — Validate a file's MAD tags`,
                    { modal: false }
                );
            } else {
                vscode.window.showInformationMessage(
                    'MAD server is not running. Check mad.server.enabled setting.',
                    'Open Settings'
                ).then(selection => {
                    if (selection === 'Open Settings') {
                        vscode.commands.executeCommand(
                            'workbench.action.openSettings',
                            'mad.server'
                        );
                    }
                });
            }
        }
    );
    context.subscriptions.push(showServerStatusCommand);
}

export function deactivate() {
    stopServer();
    console.log('MAD has been deactivated');
}
