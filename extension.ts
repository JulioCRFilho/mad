import * as vscode from 'vscode';
import { MADDecorationManager } from './src/core/ui/decoration-manager';
import { validateAndDisplayDiagram, generateDiagram, DiagramCommandContext } from './src/core/commands/diagram-command';
import { MADHoverProvider } from './src/core/ui/hover-provider';
import { MADDocumentSymbolProvider } from './src/core/ui/document-symbols';
import { MADFoldingProvider } from './src/core/ui/folding-provider';
import { filterAllNodes, readDiagramType } from './src/core/diagram/parser';

function isMarkdownDocument(document: vscode.TextDocument): boolean {
    return document.languageId === 'markdown';
}

export function activate(context: vscode.ExtensionContext) {
    console.log('MAD is active');

    const iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'icon.png').fsPath;

    // ── Auto-configure formatter when files with MAD tags are opened ──
    const configureFormatterForFile = (document: vscode.TextDocument) => {
        if (isMarkdownDocument(document)) return;

        const text = document.getText();
        const hasMADTags = text.includes('//@') || text.includes('// @');

        if (!hasMADTags) return;

        const config = vscode.workspace.getConfiguration('editor');
        const formatOnSave = config.get<boolean>('formatOnSave', false);

        // Show warning if formatOnSave is enabled
        const showWarning = vscode.workspace.getConfiguration('mad').get<boolean>('showFormatWarning', true);
        if (showWarning && formatOnSave) {
            vscode.window.showWarningMessage(
                '⚠️ O auto-formatter está ativado (formatOnSave) e pode quebrar as tags MAD. ' +
                'Use o comando "MAD: Configurar Auto-Formatter" para desabilitá-lo automaticamente.',
                'Configurar Agora'
            ).then(selection => {
                if (selection === 'Configurar Agora') {
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

    // Configure for active editor on activation
    if (vscode.window.activeTextEditor) {
        configureFormatterForFile(vscode.window.activeTextEditor.document);
    }

    // ── Decoration Manager (gutter icon) ──
    const decorationManager = new MADDecorationManager(iconPath);
    context.subscriptions.push(decorationManager);

    const updateDecorations = (editor: vscode.TextEditor) => {
        const decorations = decorationManager.provideDecorations(editor.document);
        decorationManager.apply(editor, decorations);
    };

    // ── Command: Configure formatter (disable formatOnSave) ──
    const configureFormatterCommand = vscode.commands.registerCommand(
        'mad.configureFormatter',
        async () => {
            const config = vscode.workspace.getConfiguration('editor');
            const currentFormatOnSave = config.get<boolean>('formatOnSave', false);

            if (!currentFormatOnSave) {
                vscode.window.showInformationMessage('✅ formatOnSave já está desabilitado. Nenhuma ação necessária.');
                return;
            }

            const choice = await vscode.window.showWarningMessage(
                'Isso irá desabilitar o formatOnSave no seu workspace para evitar que o auto-formatter quebre as tags MAD. Continuar?',
                'Sim, desabilitar',
                'Cancelar'
            );

            if (choice === 'Sim, desabilitar') {
                await config.update('formatOnSave', false, vscode.ConfigurationTarget.Workspace);
                vscode.window.showInformationMessage('✅ formatOnSave desabilitado com sucesso! Suas tags MAD estão protegidas.');
            }
        }
    );
    context.subscriptions.push(configureFormatterCommand);

    // ── Command: Open diagram ──
    const showDiagramCommand = vscode.commands.registerCommand(
        'mad.showDiagram',
        (lineNumber: number) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const document = editor.document;
            const lineText = document.lineAt(lineNumber).text;
            const tagMatch = lineText.match(/\/\/@([\w.]+)/);
            if (!tagMatch) return;

            const fullId = tagMatch[1];
            const prefix = fullId.split(/[0-9]/)[0];

            const diagramContext: DiagramCommandContext = {
                document: document,
                prefix: prefix,
                extensionUri: context.extensionUri
            };

            const result = validateAndDisplayDiagram(diagramContext);

            if (!result.success && result.errorMessage) {
                vscode.window.showErrorMessage(result.errorMessage);
            }
        }
    );
    context.subscriptions.push(showDiagramCommand);

    // ── Command: Generate diagram code (for AI agent validation) ──
    const generateDiagramCommand = vscode.commands.registerCommand(
        'mad.generateDiagram',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Nenhum editor ativo.');
                return;
            }

            const document = editor.document;
            const firstLine = document.lineAt(0).text;
            const tagMatch = firstLine.match(/\/\/@::(.+)/);
            if (!tagMatch) {
                vscode.window.showWarningMessage('Arquivo não contém tag de diagrama MAD.');
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
                const errorMsg = result.errorMessage || 'Erro ao gerar diagrama.';
                vscode.window.showErrorMessage(errorMsg);
                await saveToOutputFile(`ERROR: ${errorMsg}`);
                return;
            }

            await saveToOutputFile(result.code || '');
            await context.globalState.update('mad.lastDiagramCode', result.code);
            await context.globalState.update('mad.lastDiagramType', fullId);

            return {
                success: true,
                code: result.code,
                type: fullId,
                file: '/tmp/mad-diagram.mermaid'
            };
        }
    );
    context.subscriptions.push(generateDiagramCommand);

    // ── Helper: salva conteúdo em /tmp/mad-diagram.mermaid ──
    async function saveToOutputFile(content: string): Promise<string> {
        try {
            const outputFile = vscode.Uri.file('/tmp/mad-diagram.mermaid');
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(outputFile, encoder.encode(content));
            console.log(`MAD: Arquivo temporário atualizado com sucesso (${content.length} bytes)`);
            return outputFile.fsPath;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`MAD: Erro ao escrever arquivo temporário: ${errorMsg}`);
            throw error;
        }
    }

    // ── Auto-generate diagram on save (for AI agent) ──
    let lastSaveTime = 0;
    const SAVE_COOLDOWN_MS = 1000; // Evita múltiplos saves em rápida sequência
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            // Ignora markdown
            if (document.languageId === 'markdown') return;
            
            // Verifica se tem tags MAD
            const text = document.getText();
            if (!text.includes('//@') && !text.includes('// @')) return;
            
            // Verifica se tem tag de diagrama na primeira linha
            const firstLine = document.lineAt(0).text;
            const tagMatch = firstLine.match(/\/\/@::(.+)/);
            if (!tagMatch) return;
            
            // Cooldown para evitar processamento duplicado
            const now = Date.now();
            if (now - lastSaveTime < SAVE_COOLDOWN_MS) {
                console.log('MAD: Save ignorado (cooldown)');
                return;
            }
            lastSaveTime = now;
            
            console.log(`MAD: Auto-generate iniciado para ${document.fileName}`);
            
            try {
                const fullId = tagMatch[1];
                const prefix = fullId.split(/[0-9]/)[0];
                
                const diagramContext: DiagramCommandContext = {
                    document: document,
                    prefix: prefix,
                    extensionUri: context.extensionUri
                };
                
                const result = generateDiagram(diagramContext);
                
                if (result.success && result.code) {
                    const filePath = await saveToOutputFile(result.code);
                    await context.globalState.update('mad.lastDiagramCode', result.code);
                    await context.globalState.update('mad.lastDiagramType', fullId);
                    console.log(`MAD: Diagrama gerado com sucesso em ${filePath} (${result.code.length} chars)`);
                } else if (!result.success) {
                    const errorMsg = result.errorMessage || 'Erro desconhecido.';
                    await saveToOutputFile(`ERROR: ${errorMsg}`);
                    console.warn('MAD: Falha ao gerar diagrama:', errorMsg);
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error('MAD: Erro no auto-generate:', errorMsg);
                // Tenta salvar o erro mas não propaga
                try {
                    await saveToOutputFile(`ERROR: ${errorMsg}`);
                } catch (saveError) {
                    console.error('MAD: Falha crítica ao salvar arquivo de erro:', saveError);
                }
            }
        })
    );

    // ── Command: Navigate to specific line ──
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

    // ── Command: Open diagram for prefix under cursor ──
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

    // ── Command: Show diagram statistics ──
    const showStatsCommand = vscode.commands.registerCommand(
        'mad.showStats',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const allNodes = filterAllNodes(editor.document);
            const diagramType = readDiagramType(editor.document);

            const declared = allNodes.filter((n: { isArrow: boolean }) => !n.isArrow);
            const forward = allNodes.filter((n: { isArrow: boolean }) => n.isArrow);

            const groups = declared.filter((n: { id: string }) => !/\d/.test(n.id));
            const entries = declared.filter((n: { id: string }) => /^[a-zA-Z_]+[0-9]+$/.test(n.id));
            const sequences = declared.filter((n: { id: string }) => /\.[0-9]+/.test(n.id));

            const msg = [
                `**📊 MAD Stats**`,
                ``,
                `**Tipo:** \`${diagramType}\``,
                `**Total de tags:** ${allNodes.length}`,
                ``,
                `**Declarados:** ${declared.length}`,
                `  ┣ Grupos: ${groups.length}`,
                `  ┣ Entry Nodes: ${entries.length}`,
                `  ┗ Sequence Nodes: ${sequences.length}`,
                `**Forward Pointers:** ${forward.length}`,
            ].join('\n');

            vscode.window.showInformationMessage(msg, { modal: false });
        }
    );
    context.subscriptions.push(showStatsCommand);

    // ── Hover Provider: tooltip com informações da tag ──
    const hoverProvider = vscode.languages.registerHoverProvider(
        [
            { language: 'javascript' },
            { language: 'typescript' },
            { language: 'python' },
            { language: 'java' },
            { language: 'csharp' },
            { language: 'go' },
            { language: 'rust' },
            { language: 'php' },
            { language: 'dart' },
            { language: 'ruby' },
            { language: 'swift' },
            { language: 'kotlin' },
            { language: 'scala' },
            { language: 'cpp' },
            { language: 'c' },
            { language: 'sql' }
        ],
        new MADHoverProvider()
    );
    context.subscriptions.push(hoverProvider);

    // ── FoldingRange Provider: esconder/expandir blocos de tags ──
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(
            [
                { language: 'javascript' },
                { language: 'typescript' },
                { language: 'python' },
                { language: 'java' },
                { language: 'csharp' },
                { language: 'go' },
                { language: 'rust' },
                { language: 'php' },
                { language: 'dart' },
                { language: 'ruby' },
                { language: 'swift' },
                { language: 'kotlin' },
                { language: 'scala' },
                { language: 'cpp' },
                { language: 'c' },
                { language: 'sql' }
            ],
            new MADFoldingProvider()
        )
    );

    // ── Comando: Colapsar todas as tags ──
    const foldAllTagsCommand = vscode.commands.registerCommand(
        'mad.foldAllTags',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            vscode.commands.executeCommand('editor.foldAllMarkerRegions');
        }
    );
    context.subscriptions.push(foldAllTagsCommand);

    // ── Comando: Expandir todas as tags ──
    const unfoldAllTagsCommand = vscode.commands.registerCommand(
        'mad.unfoldAllTags',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            vscode.commands.executeCommand('editor.unfoldAllMarkerRegions');
            // Marca cooldown de 5 minutos para este arquivo
            const fileKey = editor.document.uri.toString();
            unfoldCooldowns.set(fileKey, Date.now() + 5 * 60 * 1000);
        }
    );
    context.subscriptions.push(unfoldAllTagsCommand);

    // ── Auto-fold tags ao abrir arquivo (com cooldown de 5min após unfold) ──
    const unfoldCooldowns = new Map<string, number>();

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            if (isMarkdownDocument(document)) return;

            const text = document.getText();
            if (!text.includes('//@') && !text.includes('// @')) return;

            const fileKey = document.uri.toString();
            const cooldownUntil = unfoldCooldowns.get(fileKey);
            
            // If on cooldown, don't fold
            if (cooldownUntil && Date.now() < cooldownUntil) return;

            setTimeout(() => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document === document) {
                    const cooldown = unfoldCooldowns.get(fileKey);
                    if (!cooldown || Date.now() >= cooldown) {
                        vscode.commands.executeCommand('editor.foldAllMarkerRegions');
                    }
                }
            }, 100);
        })
    );

    // Limpa cooldowns antigos (mais de 10 minutos)
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, cooldown] of unfoldCooldowns.entries()) {
            if (now > cooldown + 10 * 60 * 1000) {
                unfoldCooldowns.delete(key);
            }
        }
    }, 60 * 1000);
    context.subscriptions.push({ dispose: () => clearInterval(cleanupInterval) });

    // ── DocumentSymbol Provider: outline with tag tree ──
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            [
                { language: 'javascript' },
                { language: 'typescript' },
                { language: 'python' },
                { language: 'java' },
                { language: 'csharp' },
                { language: 'go' },
                { language: 'rust' },
                { language: 'php' },
                { language: 'dart' },
                { language: 'ruby' },
                { language: 'swift' },
                { language: 'kotlin' },
                { language: 'scala' },
                { language: 'cpp' },
                { language: 'c' },
                { language: 'sql' }
            ],
            new MADDocumentSymbolProvider()
        )
    );

    // ── Click detection to open diagram (with throttling) ──
    let lastClickLine = -1;
    let lastClickTime = 0;
    const CLICK_THROTTLE_MS = 300;
    const clickDetection = vscode.window.onDidChangeTextEditorSelection(event => {
        const editor = event.textEditor;
        if (!editor) return;
        if (isMarkdownDocument(editor.document)) return;

        const selection = editor.selection;
        if (!selection.isEmpty) return;

        const currentLine = selection.active.line;
        const now = Date.now();

        // Throttle: ignore if same line and within throttle window
        if (currentLine === lastClickLine && now - lastClickTime < CLICK_THROTTLE_MS) {
            return;
        }
        lastClickLine = currentLine;
        lastClickTime = now;

        updateDecorations(editor);

        const lineText = editor.document.lineAt(currentLine).text;
        if (lineText.match(/\/\/\s?@([\w.]+)/)) {
            vscode.commands.executeCommand('mad.showDiagram', currentLine);
        }
    });
    context.subscriptions.push(clickDetection);

    // ── Change listeners (with throttling) ──
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

        const now = Date.now();
        if (now - lastDecorationUpdate < DECORATION_THROTTLE_MS) {
            return;
        }
        lastDecorationUpdate = now;
        updateDecorations(editor);
    }));

    // ── Update initial decorations ──
    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor);
    }
}

export function deactivate() {
    console.log('MAD has been deactivated');
}