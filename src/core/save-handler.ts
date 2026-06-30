import * as vscode from 'vscode';
import { generateDiagram, DiagramCommandContext } from './commands/diagram-command';
import { MADDiagramPanel } from './ui/diagram-panel';
import { validateDiagramCounts } from './commands/shared/validation';
import { log } from './log';

const OUTPUT_FILE = vscode.Uri.file('/tmp/mad-diagram.mermaid');
const SAVE_COOLDOWN_MS = 1000;

let lastSaveTime = 0;

export async function saveToOutputFile(content: string, document?: vscode.TextDocument, diagramType?: string): Promise<string> {
    const outputPath = OUTPUT_FILE.fsPath;
    
    log.info(`Salvando em: ${outputPath}`);
    log.info(`Tamanho do conteúdo: ${content.length} bytes`);
    
    try {
        let finalContent = content;
        
        // Adiciona erros/warnings de validação no TOPO do arquivo
        if (document && diagramType && !content.startsWith('ERROR:')) {
            const issues = validateDiagramCounts(document.getText(), content, diagramType);
            if (issues.length > 0) {
                log.warn(`Validação: ${issues.join(' | ')}`);
                const header = `%%% VALIDATION ISSUES (${issues.length})\n` +
                    issues.map(issue => `%%%   - ${issue}`).join('\n') +
                    `\n%%% END VALIDATION\n\n`;
                finalContent = header + content;
            } else {
                log.info(`Validação OK`);
            }
        }
        
        const encoder = new TextEncoder();
        const contentBytes = encoder.encode(finalContent);
        await vscode.workspace.fs.writeFile(OUTPUT_FILE, contentBytes);
        log.info(`Arquivo salvo com sucesso: ${outputPath}`);
        
        return outputPath;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.error(`Falha ao salvar ${outputPath}: ${errorMsg}`);
        return outputPath;
    }
}

export function createSaveHandler(context: vscode.ExtensionContext) {
    return vscode.workspace.onDidSaveTextDocument(async (document) => {
        log.info(`Save detectado: ${document.fileName}`);
        
        if (document.languageId === 'markdown') {
            log.info('Ignorado: arquivo markdown');
            return;
        }
        
        const text = document.getText();
        if (!text.includes('//@') && !text.includes('// @')) {
            log.info('Ignorado: sem tags MAD');
            return;
        }
        
        const lines = text.split(/\r?\n/);
        let tagMatch: RegExpMatchArray | null = null;
        
        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(/\/\/@::(.+)/);
            if (match) {
                tagMatch = match;
                break;
            }
        }
        
        if (!tagMatch) {
            log.info('Ignorado: sem tag de diagrama //@::');
            return;
        }
        
        log.info(`Tag encontrada: ${tagMatch[1]}`);
        
        const now = Date.now();
        if (now - lastSaveTime < SAVE_COOLDOWN_MS) {
            log.info('Ignorado: cooldown ativo');
            return;
        }
        lastSaveTime = now;
        
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
                await saveToOutputFile(result.code, document, fullId);
                await context.globalState.update('mad.lastDiagramCode', result.code);
                await context.globalState.update('mad.lastDiagramType', fullId);
                log.info(`Diagrama gerado com sucesso (${result.code.length} chars)`);
                
                // Notifica sucesso se não houver warnings de validação
                const validationIssues = validateDiagramCounts(document.getText(), result.code, fullId);
                if (validationIssues.length === 0) {
                    vscode.window.showInformationMessage('✅ MAD: Diagrama validado com sucesso!', 'OK');
                }
                // Preview não abre mais automaticamente - apenas com clique explícito na TAG
            } else if (!result.success) {
                const errorMsg = result.errorMessage || 'Erro desconhecido.';
                await saveToOutputFile(`ERROR: ${errorMsg}`);
                log.warn(`Falha ao gerar diagrama: ${errorMsg}`);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            await saveToOutputFile(`ERROR: ${errorMsg}`);
            log.error(`Erro no auto-generate: ${errorMsg}`);
        }
    });
}