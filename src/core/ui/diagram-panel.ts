import * as vscode from 'vscode';

export class MADDiagramPanel {
    public static currentPanel: MADDiagramPanel | undefined;
    public static readonly viewType = 'mad.diagram';

    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, mermaidCode: string) {
        const currentColumn = vscode.window.activeTextEditor?.viewColumn;
        if (currentColumn === undefined) return;

        const besideColumn = currentColumn + 1;

        if (MADDiagramPanel.currentPanel) {
            // If already open, do NOT reopen or reveal
            // Just silently update the content
            MADDiagramPanel.currentPanel._update(mermaidCode);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            MADDiagramPanel.viewType,
            'Mermaid Diagram',
            besideColumn,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                // Content Security Policy to avoid warnings and improve security
                // Allows scripts from Mermaid and html-to-image CDNs
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'assets')
                ]
            }
        );

        MADDiagramPanel.currentPanel = new MADDiagramPanel(panel, extensionUri, mermaidCode);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, mermaidCode: string) {
        this._panel = panel;
        this._update(mermaidCode);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        
        // Handle messages from webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'close') {
                    this.dispose();
                }
            },
            null,
            this._disposables
        );
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

        // Escapes the Mermaid code for safe insertion in JS
        const escapedMermaidCode = mermaidCode
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');

        // Split code on --- to render multiple diagrams in the same preview
        const diagrams = mermaidCode
            .split(/^---$/m)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        // Placeholder divs — populated from JS via mermaid.render() so
        // the Mermaid code is never parsed as HTML (which would decode
        // entities like & back to bare &, breaking the renderer).
        const mermaidDivs = diagrams.length <= 1
            ? `<div class="mermaid" id="mermaid-0"></div>`
            : diagrams.map((_code, i) => `<div class="mermaid" id="mermaid-${i}"></div>`).join('\n                ');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mermaid Diagram</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src https://cdn.jsdelivr.net data:;">
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js"></script>
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
            flex-wrap: wrap;
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
            white-space: nowrap;
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
        .toolbar .search-input {
            background: ${colors.tertiary};
            border: 1px solid ${colors.line}66;
            color: ${colors.text};
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-family: inherit;
            width: 160px;
        }
        .toolbar .search-input:focus {
            outline: none;
            border-color: ${colors.primary};
        }
        .mermaid-container {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 24px;
            overflow: hidden;
            cursor: grab;
        }
        .mermaid-container.dragging {
            cursor: grabbing;
        }
        .mermaid {
            display: flex;
            justify-content: center;
            min-height: 200px;
            width: 100%;
        }
        .mermaid svg {
            max-width: 100%;
            height: auto !important;
        }
        .zoom-controls {
            display: flex;
            gap: 4px;
            align-items: center;
        }
        .zoom-controls button {
            padding: 4px 8px;
            font-size: 11px;
            min-width: 28px;
        }
        .zoom-controls span {
            font-size: 11px;
            opacity: 0.7;
            min-width: 36px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button onclick="copyToClipboard()" title="Copy Mermaid code">📋 Copy</button>
                <button class="secondary" onclick="exportAsSVG()" title="Export as SVG">📥 SVG</button>
        <button class="secondary" onclick="exportAsPNG()" title="Exportar como PNG">🖼 PNG</button>
        <div class="zoom-controls">
            <button onclick="zoomOut()" title="Zoom out">−</button>
            <span id="zoomLevel">100%</span>
            <button onclick="zoomIn()" title="Zoom in">+</button>
            <button onclick="resetZoom()" title="Reset zoom">↺</button>
        </div>
        <input type="text" class="search-input" id="searchInput" placeholder="🔍 Search nodes..." oninput="filterNodes(this.value)" />
        <span class="status" id="status"></span>
    </div>
    <div class="mermaid-container" id="mermaidContainer">
        <div class="mermaid-wrapper" id="mermaidContent">
            ${mermaidDivs}
        </div>
    </div>
    <script>
        const MERMAID_CODE = \`${escapedMermaidCode}\`;
        let currentZoom = 1.0;
        let translateX = 0;
        let translateY = 0;
        const ZOOM_STEP = 0.1;
        const MIN_ZOOM = 0.3;
        const MAX_ZOOM = 5.0;

        mermaid.initialize({
            startOnLoad: false,
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

        // Render all diagrams from the JS variable (NOT from HTML content)
        // using mermaid.render(). This avoids the browser's HTML parser from
        // decoding & back to bare &, which breaks the Mermaid renderer.
        const DIAGRAMS = MERMAID_CODE.split('---').map(s => s.trim()).filter(s => s.length > 0);
        if (DIAGRAMS.length === 0) DIAGRAMS.push(MERMAID_CODE);

        window.addEventListener('load', async () => {
            const divs = document.querySelectorAll('.mermaid');
            for (let i = 0; i < Math.min(divs.length, DIAGRAMS.length); i++) {
                try {
                    const code = DIAGRAMS[i];
                    const { svg } = await mermaid.render('mermaid-svg-' + i, code);
                    divs[i].innerHTML = svg;
                } catch (err) {
                    const errMsg = (err.message || String(err)).replace(/</g, '&' + 'lt;');
                    divs[i].innerHTML = '<div style="color:#F44747;padding:20px;font-family:sans-serif">' +
                        '<strong>Mermaid render error</strong><br>' + errMsg + '</div>';
                }
            }
        });

        function setStatus(msg, isError) {
            const el = document.getElementById('status');
            el.textContent = msg;
            el.style.color = isError ? '#e74c3c' : '';
            setTimeout(() => { el.textContent = ''; }, 3000);
        }

        function updateTransform() {
            const el = document.querySelector('.mermaid-wrapper');
            if (el) {
                el.style.zoom = currentZoom;
                el.style.transform = \`translate(\${translateX}px, \${translateY}px)\`;
            }
            document.getElementById('zoomLevel').textContent = Math.round(currentZoom * 100) + '%';
        }

        function updateZoom() {
            updateTransform();
        }

        function zoomIn() {
            currentZoom = Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM);
            updateZoom();
        }

        function zoomOut() {
            currentZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM);
            updateZoom();
        }

        function resetZoom() {
            currentZoom = 1.0;
            updateZoom();
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
                await mermaid.run({ nodes: [document.getElementById('mermaidContent')] });
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

        async function exportAsPNG() {
            try {
                await mermaid.run({ nodes: [document.getElementById('mermaidContent')] });
                const container = document.getElementById('mermaidContainer');
                // Reset zoom temporarily for full quality export
                const originalZoom = currentZoom;
                currentZoom = 1.0;
                updateZoom();
                // Wait for re-render
                await new Promise(r => setTimeout(r, 100));
                const canvas = await htmlToImage.toCanvas(container, {
                    backgroundColor: '${colors.background}',
                    pixelRatio: 2,
                    filter: (node) => {
                        // Exclude toolbar from screenshot
                        return !node.classList || !node.classList.contains('toolbar');
                    }
                });
                currentZoom = originalZoom;
                updateZoom();
                const link = document.createElement('a');
                link.download = 'diagram.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                setStatus('✓ PNG exported');
            } catch (err) {
                // Restore zoom on error
                currentZoom = 1.0;
                updateZoom();
                setStatus('✗ PNG export failed: ' + err.message, true);
            }
        }

        function filterNodes(query) {
            const svg = document.querySelector('.mermaid svg');
            if (!svg) return;
            const allNodes = svg.querySelectorAll('[id^="flowchart-"], [id^="graph-"], .cluster, .node');
            allNodes.forEach(node => {
                const text = node.textContent.toLowerCase();
                const rects = node.querySelectorAll('rect, ellipse, polygon');
                if (!query) {
                    node.style.opacity = '1';
                    node.style.filter = '';
                    return;
                }
                const matches = text.includes(query.toLowerCase());
                node.style.opacity = matches ? '1' : '0.15';
                node.style.filter = matches ? 'brightness(1.2)' : 'grayscale(1)';
            });
            setStatus(query ? \`Filtered: "\${query}"\` : 'Filter cleared');
        }

        // Pan functionality
        const container = document.getElementById('mermaidContainer');
        const mermaidContent = document.getElementById('mermaidContent');
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialTranslateX = 0;
        let initialTranslateY = 0;

        container.addEventListener('mousedown', (e) => {
            if (e.target.closest('.toolbar')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialTranslateX = translateX;
            initialTranslateY = translateY;
            container.classList.add('dragging');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = (e.clientX - startX) / currentZoom;
            const dy = (e.clientY - startY) / currentZoom;
            translateX = initialTranslateX + dx;
            translateY = initialTranslateY + dy;
            updateTransform();
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            container.classList.remove('dragging');
        });

        // Pinch zoom (trackpad gesture)
        container.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
                currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + delta));
                updateTransform();
            }
        }, { passive: false });

        // Responsive resize — re-render on window resize to fit available space
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(async () => {
                const divs = document.querySelectorAll('.mermaid');
                for (let i = 0; i < Math.min(divs.length, DIAGRAMS.length); i++) {
                    try {
                        const code = DIAGRAMS[i];
                        const { svg } = await mermaid.render('mermaid-svg-' + i + '-r', code);
                        divs[i].innerHTML = svg;
                    } catch (err) {
                        // Keep existing render on error
                    }
                }
            }, 100);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    zoomIn();
                } else if (e.key === '-') {
                    e.preventDefault();
                    zoomOut();
                } else if (e.key === '0') {
                    e.preventDefault();
                    resetZoom();
                }
            }
            if (e.key === 'Escape') {
                const searchInput = document.getElementById('searchInput');
                if (searchInput.value) {
                    searchInput.value = '';
                    filterNodes('');
                } else {
                    // Close the panel if search is empty
                    vscode.postMessage({ command: 'close' });
                }
            }
            if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
                const input = document.getElementById('searchInput');
                if (document.activeElement !== input) {
                    e.preventDefault();
                    input.focus();
                }
            }
        });
    </script>
</body>
</html>`;
    }

    public dispose() {
        MADDiagramPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
