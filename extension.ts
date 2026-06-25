import * as vscode from 'vscode';

/**
 * Gerenciador de decorações com ícone de polvo na margem
 */
class MDDDDecorationManager {
    private decorationType: vscode.TextEditorDecorationType;
    
    constructor(iconPath: string) {
        this.decorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: vscode.Uri.file(iconPath),
            gutterIconSize: 'contain',
            isWholeLine: true
        });
    }
    
    provideDecorations(document: vscode.TextDocument): vscode.DecorationOptions[] {
        const decorations: vscode.DecorationOptions[] = [];
        const text = document.getText();
        const lines = text.split(/\r?\n/);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.match(/\/\/@([\w.]+)/)) {
                const range = new vscode.Range(i, 0, i, 0);
                decorations.push({
                    range: range,
                    hoverMessage: 'Open diagram'
                });
            }
        }
        
        return decorations;
    }
    
    apply(editor: vscode.TextEditor, decorations: vscode.DecorationOptions[]) {
        editor.setDecorations(this.decorationType, decorations);
    }
    
    dispose() {
        this.decorationType.dispose();
    }
}

/**
 * Utilitário para transformar nomes em labels legíveis
 */
function toReadableLabel(name: string): string {
    let cleaned = name.replace(/^_+/, '');
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
    cleaned = cleaned.replace(/[_-]+/g, ' ');
    cleaned = cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
    cleaned = cleaned.trim().replace(/\s+/g, ' ');
    return cleaned;
}

/**
 * Extrai o identificador da linha, ignorando keywords
 */
function extractIdentifierBelow(lineText: string): string | null {
    let code = lineText.replace(/^\s*\/\/.*$/, '').replace(/^\s*#.*$/, '').replace(/^\s*--.*$/, '');
    
    const keywords = /\b(class|function|const|let|var|interface|type|enum|struct|def|func|public|private|protected|static|async|await|import|export|from|return|if|else|for|while|do|switch|case|break|continue|new|this|super|extends|implements|abstract|final|override|void|int|string|boolean|number|any|null|undefined|char|float|double|byte|short|long|signed|unsigned)\b/;
    
    let cleaned = code.replace(/^\s*/, '');
    while (keywords.test(cleaned)) {
        cleaned = cleaned.replace(keywords, '').trim();
    }
    
    const match = cleaned.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)/);
    
    if (match && match[1]) {
        return match[1];
    }
    
    return null;
}

/**
 * Filtra todos os nós //@ do documento
 */
function filterAllNodes(document: vscode.TextDocument): Array<{line: number, id: string, description: string | null, isArrow: boolean}> {
    const allNodes: Array<{line: number, id: string, description: string | null, isArrow: boolean}> = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Verifica //@->ID:comentário (forward pointer)
        const arrowMatch = line.match(/\/\/@->([\w.]+)(?::([^\n]+))?/);
        if (arrowMatch) {
            allNodes.push({
                line: i,
                id: arrowMatch[1],
                description: arrowMatch[2] ? arrowMatch[2].trim() : null,
                isArrow: true
            });
            continue;
        }
        
        // Verifica //@ID:comentário (retro pointer)
        const tagMatch = line.match(/\/\/@([\w.]+)(?::([^\n]+))?/);
        if (tagMatch) {
            allNodes.push({
                line: i,
                id: tagMatch[1],
                description: tagMatch[2] ? tagMatch[2].trim() : null,
                isArrow: false
            });
        }
    }
    
    return allNodes;
}

/**
 * Separa nós em retro pointers //@ e forward pointers //@->
 */
function splitNodes(allNodes: Array<{line: number, id: string, description: string | null, isArrow: boolean}>): {
    retroPointers: Array<{line: number, id: string, description: string | null}>,
    forwardPointers: Array<{line: number, id: string, description: string | null}>
} {
    const retroPointers: Array<{line: number, id: string, description: string | null}> = [];
    const forwardPointers: Array<{line: number, id: string, description: string | null}> = [];
    
    for (const node of allNodes) {
        if (node.isArrow) {
            forwardPointers.push({
                line: node.line,
                id: node.id,
                description: node.description
            });
        } else {
            retroPointers.push({
                line: node.line,
                id: node.id,
                description: node.description
            });
        }
    }
    
    return { retroPointers, forwardPointers };
}

/**
 * Filtra grupos (IDs sem números)
 */
function filterGroups(nodes: Array<{line: number, id: string, label?: string, description?: string | null, connections?: Array<{id: string, label: string}>}>): Array<{line: number, id: string, label?: string, description?: string | null, connections?: Array<{id: string, label: string}>}> {
    return nodes.filter(node => !/\d/.test(node.id));
}

/**
 * Filtra nós de entrada (prefix+ número simples)
 */
function filterPrefix(nodes: Array<{line: number, id: string, label?: string, description?: string | null, connections?: Array<{id: string, label: string}>}>): Array<{line: number, id: string, label?: string, description?: string | null, connections?: Array<{id: string, label: string}>}> {
    return nodes.filter(node => /^[a-zA-Z_]+[0-9]+$/.test(node.id));
}

/**
 * Filtra nós de sequência (prefix+ número.número...)
 */
function filterSequences(nodes: Array<{line: number, id: string, label?: string, description?: string | null, connections?: Array<{id: string, label: string}>}>): Array<{line: number, id: string, label?: string, description?: string | null, connections?: Array<{id: string, label: string}>}> {
    return nodes.filter(node => /\.[0-9]+/.test(node.id));
}

/**
 * Valida se todos os IDs referenciados em //@-> existem como nós declarados
 */
function validateDiagram(
    allNodes: Array<{line: number, id: string, description: string | null, isArrow: boolean}>,
    prefix: string
): { valid: boolean; errors: Array<{line: number, missingId: string}> } {
    const errors: Array<{line: number, missingId: string}> = [];
    
    const prefixLower = prefix.toLowerCase();
    
    // Coleta todos os IDs declarados (não são arrows) que começam com o prefixo
    const declaredIds = new Set<string>();
    for (const node of allNodes) {
        if (!node.isArrow) {
            const nodeLower = node.id.toLowerCase();
            if (nodeLower.startsWith(prefixLower)) {
                declaredIds.add(node.id);
            }
        }
    }
    
    // Verifica se todos os //@-> apontam para IDs existentes
    for (const node of allNodes) {
        if (node.isArrow) {
            const targetLower = node.id.toLowerCase();
            if (targetLower.startsWith(prefixLower)) {
                if (!declaredIds.has(node.id)) {
                    errors.push({
                        line: node.line,
                        missingId: node.id
                    });
                }
            }
        }
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Escaneia o documento para encontrar todas as tags //@ com o mesmo prefixo
 * Seguindo o fluxo: FilterNodes → SplitTypes → RetroPointers/ForwardPointers → Filtering → WriteDiagram → Validate
 */
function findRelatedTags(document: vscode.TextDocument, prefix: string): Array<{line: number, id: string, label: string, description: string | null, connections: Array<{id: string, label: string}>}> {
    // Step 1: Filter all //@ nodes
    const allNodes = filterAllNodes(document);
    
    // Step 2: Split types (retro vs forward)
    const { retroPointers, forwardPointers } = splitNodes(allNodes);
    
    // Step 3: Process retro pointers (//@)
    const processedRetro: Array<{line: number, id: string, label: string, description: string | null}> = [];
    for (const node of retroPointers) {
        const nodeLower = node.id.toLowerCase();
        const prefixLower = prefix.toLowerCase();
        // Verifica se o ID começa com o prefixo (para capturar Login2, Login2.1, Login2.1.1)
        if (!nodeLower.startsWith(prefixLower)) continue;
        
        // Extrai identificador do código abaixo
        const text = document.getText();
        const lines = text.split(/\r?\n/);
        let identifier: string | null = null;
        let j = node.line + 1;
        
        while (j < lines.length && lines[j].match(/\/\/@/)) {
            j++;
        }
        
        if (j < lines.length) {
            identifier = extractIdentifierBelow(lines[j]);
        }
        
        const label = identifier ? toReadableLabel(identifier) : node.id;
        processedRetro.push({
            line: node.line,
            id: node.id,
            label: label,
            description: node.description
        });
    }
    
    // Step 4: Process forward pointers (//@->)
    const processedForward: Array<{line: number, id: string, label: string, connections: Array<{id: string, label: string}>}> = [];
    for (const node of forwardPointers) {
        const targetLower = node.id.toLowerCase();
        const prefixLower = prefix.toLowerCase();
        // Verifica se o ID alvo começa com o prefixo
        if (!targetLower.startsWith(prefixLower)) continue;
        
        // Verifica se o alvo existe
        const targetDeclared = allNodes.some(n => n.id === node.id && !n.isArrow);
        if (!targetDeclared) {
            vscode.window.showErrorMessage(
                `Erro: //@->${node.id} (linha ${node.line + 1}) aponta para "${node.id}" que não foi declarado. Crie //@${node.id} primeiro.`
            );
            return [];
        }
        
        const text = document.getText();
        const lines = text.split(/\r?\n/);
        let identifier: string | null = null;
        let j = node.line + 1;
        
        while (j < lines.length && lines[j].match(/\/\/@/)) {
            j++;
        }
        
        if (j < lines.length) {
            identifier = extractIdentifierBelow(lines[j]);
        }
        
        const sourceName = identifier || 'Unknown';
        const syntheticId = `${sourceName}_${node.line}`;
        const label = identifier ? toReadableLabel(identifier) : node.id;
        
        processedForward.push({
            line: node.line,
            id: syntheticId,
            label: label,
            connections: [{ id: node.id, label: node.description || '' }]
        });
    }
    
    // Step 5: Filtering - FilterGroups → FilterPrefix → FilterSequences
    const allProcessed = [...processedRetro.map(n => ({...n, connections: [] as Array<{id: string, label: string}>})), 
                          ...processedForward];
    
    const groups = filterGroups(allProcessed);
    const prefixNodes = filterPrefix(allProcessed);
    const sequenceNodes = filterSequences(allProcessed);
    
    // Combina todos os nós filtrados e normaliza tipos
    const filteredNodes = [...groups, ...prefixNodes, ...sequenceNodes].map(node => ({
        line: node.line,
        id: node.id,
        label: node.label || node.id,
        description: node.description || null,
        connections: node.connections || []
    })) as Array<{line: number, id: string, label: string, description: string | null, connections: Array<{id: string, label: string}>}>;
    
    // Remove duplicatas mantendo ordem
    const uniqueNodes = filteredNodes.filter((node, index, self) => 
        index === self.findIndex(n => n.id === node.id)
    );
    
    // Ordena por ID
    uniqueNodes.sort((a, b) => {
        const numsA = a.id.match(/\d+/g)?.map(Number) || [0];
        const numsB = b.id.match(/\d+/g)?.map(Number) || [0];
        
        for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
            const numA = numsA[i] || 0;
            const numB = numsB[i] || 0;
            if (numA !== numB) return numA - numB;
        }
        return 0;
    });
    
    // Step 6: Validate diagram
    const validation = validateDiagram(allNodes, prefix);
    if (!validation.valid) {
        const errorMessages = validation.errors.map(e => 
            `ID "${e.missingId}" não encontrado na linha ${e.line + 1}`
        ).join('\n');
        
        vscode.window.showErrorMessage(
            `Diagrama inválido:\n${errorMessages}`
        );
        return [];
    }
    
    return uniqueNodes;
}

/**
 * Encontra o ID do pai de um item numerado
 */
function findParentId(id: string, groups: Array<{id: string}>): string | null {
    const lastDotIndex = id.lastIndexOf('.');
    if (lastDotIndex > 0) {
        const parentId = id.substring(0, lastDotIndex);
        return parentId;
    }
    
    const match = id.match(/^([a-zA-Z_]+)\d+$/);
    if (match) {
        const groupId = match[1];
        if (groups.some(g => g.id === groupId)) {
            return groupId;
        }
    }
    
    return null;
}

/**
 * Gera o código Mermaid flowchart TD estilizado baseado nas tags relacionadas
 * Usa flowchart TD com cores temáticas do usuário
 */
function generateMermaidDiagram(tags: Array<{line: number, id: string, label: string, description: string | null, connections: Array<{id: string, label: string}>}>): string {
    if (tags.length === 0) {
        return 'flowchart TD\n    A[Nenhuma tag relacionada encontrada]';
    }
    
    const groups = tags.filter(t => !/\d/.test(t.id));
    const numbered = tags.filter(t => /\d/.test(t.id));
    
    const sortedGroups = [...groups].sort((a, b) => a.id.localeCompare(b.id));
    
    const getGroupPrefix = (id: string) => id.split(/[0-9]/)[0].toLowerCase();

    const sortedNumbered = [...numbered].sort((a, b) => {
        const numsA = a.id.match(/\d+/g)?.map(Number) || [0];
        const numsB = b.id.match(/\d+/g)?.map(Number) || [0];
        
        for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
            const numA = numsA[i] || 0;
            const numB = numsB[i] || 0;
            if (numA !== numB) return numA - numB;
        }
        return 0;
    });
    
    let mermaid = 'flowchart TD\n';
    const idToNodeId = new Map<string, string>();
    let nodeIndex = 0;
    
    const allocated = new Set<string>();
    
    for (const group of sortedGroups) {
        const safeLabel = group.label.replace(/"/g, '"');
        const groupPrefix = getGroupPrefix(group.id);
        mermaid += `    subgraph ${safeLabel}\n`;
        
        // Nó de entrada do grupo
        const entryNodeId = `N${nodeIndex++}`;
        idToNodeId.set(group.id, entryNodeId);
        mermaid += `        ${entryNodeId}["${safeLabel}"]\n`;
        
        // Itens cujo ID começa com o ID do grupo (case-insensitive)
        // OU que tem conexão para um ID que está no grupo
        const groupItems = sortedNumbered.filter(item => {
            const itemLower = item.id.toLowerCase();
            const groupLower = group.id.toLowerCase();
            
            // Verifica se o ID do item começa com o ID do grupo
            const startsWithGroup = itemLower === groupLower || itemLower.startsWith(groupLower);
            
            // Verifica se o item tem conexão para um ID que está no grupo
            const hasConnectionToGroup = item.connections && item.connections.some(conn => {
                const connLower = conn.id.toLowerCase();
                return connLower === groupLower || connLower.startsWith(groupLower);
            });
            
            return startsWithGroup || hasConnectionToGroup;
        });
        
        for (const item of groupItems) {
            const nodeId = `N${nodeIndex++}`;
            const safeItemLabel = item.label.replace(/"/g, '"');
            idToNodeId.set(item.id, nodeId);
            mermaid += `        ${nodeId}["${safeItemLabel}"]\n`;
            allocated.add(item.id);
        }
        
        mermaid += `    end\n`;
    }
    
    // Nós não alocados (sintéticos de //@->)
    for (const item of sortedNumbered) {
        if (!allocated.has(item.id)) {
            const nodeId = `N${nodeIndex++}`;
            const safeLabel = item.label.replace(/"/g, '"');
            idToNodeId.set(item.id, nodeId);
            mermaid += `    ${nodeId}["${safeLabel}"]\n`;
            
            // Se o nó tem conexões, verifica se o alvo da conexão está em um grupo
            // e adiciona uma seta implícita para o grupo pai
            if (item.connections && item.connections.length > 0) {
                for (const conn of item.connections) {
                    const connLower = conn.id.toLowerCase();
                    const groupEntry = [...sortedGroups].find(g => {
                        const groupLower = g.id.toLowerCase();
                        return connLower === groupLower || connLower.startsWith(groupLower);
                    });
                    if (groupEntry) {
                        const parentNode = idToNodeId.get(groupEntry.id);
                        if (parentNode) {
                            mermaid += `    ${parentNode} --> ${nodeId}\n`;
                        }
                    }
                }
            }
        }
    }
    
    // Arestas
    for (const item of sortedNumbered) {
        const src = idToNodeId.get(item.id);
        if (!src) continue;
        
        // Seta pai-filho retroativa (//@ID:desc) — conecta grupo → item
        const itemLower = item.id.toLowerCase();
        const groupEntry = [...sortedGroups].find(g => {
            const groupLower = g.id.toLowerCase();
            return itemLower === groupLower || itemLower.startsWith(groupLower);
        });
        const parentNode = groupEntry ? idToNodeId.get(groupEntry.id) : undefined;
        if (parentNode) {
            if (item.description && item.description.trim()) {
                mermaid += `    ${parentNode} -->|${item.description.replace(/"/g, '"')}| ${src}\n`;
            } else {
                mermaid += `    ${parentNode} --> ${src}\n`;
            }
        }
        
        // Conexões explícitas (//@->ID:desc)
        if (item.connections && item.connections.length > 0) {
            for (const conn of item.connections) {
                const dst = idToNodeId.get(conn.id);
                if (dst) {
                    if (conn.label && conn.label.trim()) {
                        mermaid += `    ${src} -->|${conn.label.replace(/"/g, '"')}| ${dst}\n`;
                    } else {
                        mermaid += `    ${src} --> ${dst}\n`;
                    }
                }
            }
        }
    }
    
    return mermaid;
}

/**
 * Valida e exibe o diagrama, retornando mensagem de erro se inválido
 */
function validateAndDisplayDiagram(
    document: vscode.TextDocument, 
    prefix: string,
    extensionUri: vscode.Uri
): { success: boolean; errorMessage?: string } {
    // Filtra todos os nós
    const allNodes = filterAllNodes(document);
    
    // Separa tipos
    const { retroPointers, forwardPointers } = splitNodes(allNodes);
    
    // Valida diagrama
    const validation = validateDiagram(allNodes, prefix);
    
    if (!validation.valid) {
        const errorMessages = validation.errors.map(e => 
            `Linha ${e.line + 1}: ID "${e.missingId}" não encontrado`
        ).join('\n');
        
        return {
            success: false,
            errorMessage: `Diagrama inválido:\n${errorMessages}`
        };
    }
    
    // Gera diagrama
    const relatedTags = findRelatedTags(document, prefix);
    const mermaidCode = generateMermaidDiagram(relatedTags);
    
    // Exibe diagrama
    MDDDDiagramPanel.createOrShow(extensionUri, mermaidCode);
    
    return { success: true };
}

/**
 * Painel Webview para exibir diagramas Mermaid
 */
class MDDDDiagramPanel {
    public static currentPanel: MDDDDiagramPanel | undefined;
    public static readonly viewType = 'mddd.diagram';
    
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    
    public static createOrShow(extensionUri: vscode.Uri, mermaidCode: string) {
        const currentColumn = vscode.window.activeTextEditor?.viewColumn;
        if (currentColumn === undefined) return;
        
        const besideColumn = currentColumn + 1;
        
        if (MDDDDiagramPanel.currentPanel) {
            MDDDDiagramPanel.currentPanel._panel.reveal(besideColumn);
            MDDDDiagramPanel.currentPanel._update(mermaidCode);
            return;
        }
        
        const panel = vscode.window.createWebviewPanel(
            MDDDDiagramPanel.viewType,
            'Diagrama Mermaid',
            besideColumn,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        MDDDDiagramPanel.currentPanel = new MDDDDiagramPanel(panel, extensionUri, mermaidCode);
    }
    
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, mermaidCode: string) {
        this._panel = panel;
        this._update(mermaidCode);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }
    
    private _update(mermaidCode: string) {
        const html = this._getHtmlForWebview(mermaidCode);
        this._panel.webview.html = html;
    }
    
    private _getHtmlForWebview(mermaidCode: string): string {
        const isDarkTheme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
        
        const colors = isDarkTheme ? {
            primary: '#007acc',
            primaryText: '#fff',
            line: '#666',
            secondary: '#2d2d2d',
            tertiary: '#1e1e1e',
            background: '#1e1e1e',
            text: '#d4d4d4'
        } : {
            primary: '#007acc',
            primaryText: '#fff',
            line: '#666',
            secondary: '#f5f5f5',
            tertiary: '#fff',
            background: '#ffffff',
            text: '#333333'
        };
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagrama Mermaid</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            background-color: ${colors.background};
            color: ${colors.text};
        }
        .mermaid {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 200px;
        }
    </style>
</head>
<body>
    <div class="mermaid">
        ${mermaidCode}
    </div>
    <script>
        mermaid.initialize({
            startOnLoad: true,
            theme: '${isDarkTheme ? 'dark' : 'default'}',
            themeVariables: {
                primaryColor: '${colors.primary}',
                primaryTextColor: '${colors.primaryText}',
                primaryBorderColor: '${colors.primary}',
                lineColor: '${colors.line}',
                secondaryColor: '${colors.secondary}',
                tertiaryColor: '${colors.tertiary}'
            }
        });
    </script>
</body>
</html>`;
    }
    
    public dispose() {
        MDDDDiagramPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}

/**
 * Ativa a extensão
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('MDDD Extension está ativa');
    
    const iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'icon.png').fsPath;
    
    const decorationManager = new MDDDDecorationManager(iconPath);
    context.subscriptions.push(decorationManager);
    
    const updateDecorations = (editor: vscode.TextEditor) => {
        const decorations = decorationManager.provideDecorations(editor.document);
        decorationManager.apply(editor, decorations);
    };
    
    const showDiagramCommand = vscode.commands.registerCommand(
        'mddd.showDiagram',
        (lineNumber: number) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            
            const document = editor.document;
            const lineText = document.lineAt(lineNumber).text;
            const tagMatch = lineText.match(/\/\/@([\w.]+)/);
            if (!tagMatch) return;
            
            const fullId = tagMatch[1];
            const prefix = fullId.split(/[0-9]/)[0];
            
            // Valida e exibe o diagrama
            const result = validateAndDisplayDiagram(document, prefix, context.extensionUri);
            
            if (!result.success && result.errorMessage) {
                vscode.window.showErrorMessage(result.errorMessage);
            }
        }
    );
    context.subscriptions.push(showDiagramCommand);
    
    let lastClickLine = -1;
    const clickDetection = vscode.window.onDidChangeTextEditorSelection(event => {
        const editor = event.textEditor;
        if (!editor) return;
        
        const selection = editor.selection;
        if (!selection.isEmpty) return;
        
        const currentLine = selection.active.line;
        
        if (currentLine === lastClickLine) return;
        lastClickLine = currentLine;
        
        updateDecorations(editor);
        
        const lineText = editor.document.lineAt(currentLine).text;
        if (lineText.match(/\/\/@([\w.]+)/)) {
            vscode.commands.executeCommand('mddd.showDiagram', currentLine);
        }
    });
    context.subscriptions.push(clickDetection);
    
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) updateDecorations(editor);
    }));
    
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) updateDecorations(editor);
    }));
    
    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor);
    }
}

export function deactivate() {
    console.log('MDDD Extension foi desativada');
}