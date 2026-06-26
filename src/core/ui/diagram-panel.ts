import * as vscode from 'vscode';

export class MDDDDiagramPanel {
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

        // Escapa o código Mermaid para inserção segura no JS
        const escapedMermaidCode = mermaidCode
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');

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
            padding: 0;
            margin: 0;
            background-color: ${colors.background};
            color: ${colors.text};
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .toolbar {
            display: flex;
            gap: 8px;
            padding: 8px 12px;
            background-color: ${colors.secondary};
            border-bottom: 1px solid ${colors.line}33;
            flex-shrink: 0;
            align-items: center;
        }
        .toolbar button {
            background: ${colors.primary};
            color: ${colors.primaryText};
            border: none;
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-family: inherit;
            transition: opacity 0.2s;
        }
        .toolbar button:hover {
            opacity: 0.85;
        }
        .toolbar button.secondary {
            background: transparent;
            color: ${colors.text};
            border: 1px solid ${colors.line}66;
        }
        .toolbar .status {
            margin-left: auto;
            font-size: 11px;
            opacity: 0.7;
        }
        .mermaid-container {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 24px;
            overflow: auto;
        }
        .mermaid {
            display: flex;
            justify-content: center;
            min-height: 200px;
            width: 100%;
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button onclick="copyToClipboard()" title="Copiar código Mermaid">📋 Copy</button>
        <button class="secondary" onclick="exportAsSVG()" title="Exportar como SVG">📥 Export SVG</button>
        <span class="status" id="status"></span>
    </div>
    <div class="mermaid-container">
        <div class="mermaid" id="mermaidContainer">
            ${mermaidCode}
        </div>
    </div>
    <script>
        const MERMAID_CODE = \`${escapedMermaidCode}\`;

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

        function setStatus(msg, isError) {
            const el = document.getElementById('status');
            el.textContent = msg;
            el.style.color = isError ? '#e74c3c' : '';
            setTimeout(() => { el.textContent = ''; }, 3000);
        }

        async function copyToClipboard() {
            try {
                await navigator.clipboard.writeText(MERMAID_CODE);
                setStatus('✓ Copied!');
            } catch (err) {
                setStatus('✗ Copy failed', true);
            }
        }

        async function exportAsSVG() {
            try {
                // Aguarda renderização
                await mermaid.run({ nodes: [document.getElementById('mermaidContainer')] });
                const svgEl = document.querySelector('.mermaid svg');
                if (!svgEl) {
                    setStatus('✗ No SVG found', true);
                    return;
                }
                const svgClone = svgEl.cloneNode(true);
                svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(svgClone);
                const blob = new Blob([svgString], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'diagram.svg';
                a.click();
                URL.revokeObjectURL(url);
                setStatus('✓ SVG exported');
            } catch (err) {
                setStatus('✗ Export failed', true);
            }
        }
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