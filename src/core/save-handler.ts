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
    
    log.info(`Saving to: ${outputPath}`);
    log.info(`Content size: ${content.length} bytes`);
    
    try {
        let finalContent = content;
        
        // Add validation errors/warnings at the TOP of the file
        if (document && diagramType && !content.startsWith('ERROR:')) {
            const issues = validateDiagramCounts(document.getText(), content, diagramType);
            if (issues.length > 0) {
                log.warn(`Validation: ${issues.join(' | ')}`);
                const header = `%%% VALIDATION ISSUES (${issues.length})\n` +
                    issues.map(issue => `%%%   - ${issue}`).join('\n') +
                    `\n%%% END VALIDATION\n\n`;
                finalContent = header + content;
            } else {
                log.info(`Validation OK`);
            }
        }
        
        const encoder = new TextEncoder();
        const contentBytes = encoder.encode(finalContent);
        await vscode.workspace.fs.writeFile(OUTPUT_FILE, contentBytes);
        log.info(`File saved successfully: ${outputPath}`);
        
        return outputPath;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.error(`Failed to save ${outputPath}: ${errorMsg}`);
        return outputPath;
    }
}

export function createSaveHandler(context: vscode.ExtensionContext) {
    return vscode.workspace.onDidSaveTextDocument(async (document) => {
        log.info(`Save detected: ${document.fileName}`);
        
        if (document.languageId === 'markdown') {
            log.info('Ignored: markdown file');
            return;
        }
        
        const text = document.getText();
        if (!text.includes('//@') && !text.includes('// @')) {
            log.info('Ignored: no MAD tags');
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
            log.info('Ignored: no diagram tag //@::');
            return;
        }
        
        log.info(`Tag found: ${tagMatch[1]}`);
        
        const now = Date.now();
        if (now - lastSaveTime < SAVE_COOLDOWN_MS) {
            log.info('Ignored: cooldown active');
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
                log.info(`Diagram generated successfully (${result.code.length} chars)`);
                
                // Notify success if there are no validation warnings
                const validationIssues = validateDiagramCounts(document.getText(), result.code, fullId);
                if (validationIssues.length === 0) {
                    vscode.window.showInformationMessage('✅ MAD: Diagram validated successfully!', 'OK');
                }
                // Preview no longer opens automatically - only with explicit click on the TAG
            } else if (!result.success) {
                const errorMsg = result.errorMessage || 'Unknown error.';
                await saveToOutputFile(`ERROR: ${errorMsg}`);
                log.warn(`Failed to generate diagram: ${errorMsg}`);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            await saveToOutputFile(`ERROR: ${errorMsg}`);
            log.error(`Error in auto-generate: ${errorMsg}`);
        }
    });
}