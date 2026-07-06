/**
 * Core validation handler for the HTTP server.
 *
 * Accepts a file path, reads the file, and runs the full MAD pipeline:
 *   parse → MAD validation → tag processing → Mermaid generation →
 *   Mermaid validation → count validation → write output.
 *
 * Designed to work with raw file text — no vscode.TextDocument required.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    ValidateRequest,
    ValidateResponse,
    ValidateResponseSuccess,
    ValidateResponseError,
} from './types';
import { filterAllNodesFromText, splitNodes, readDiagramTypeFromText } from '../diagram/parser';
import { validateDiagram } from '../diagram/validator';
import { validateMermaidSyntax } from '../diagram/mermaid-validator';
import { generateMermaidDiagram } from '../diagram/generator';
import {
    parseAllTags,
    validateDiagramCounts,
} from '../commands/shared/validation';
import { findRelatedTagsFromText } from '../commands/shared/helpers';

const OUTPUT_FILE = '/tmp/mad-diagram.mermaid';

/**
 * Runs the full validation and generation pipeline for a file path.
 * Returns structured results suitable for the HTTP response.
 */
export function validateFile(filePath: string): ValidateResponse {
    const start = Date.now();

    // Step 1: Resolve and check file existence
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
        return {
            status: 'error',
            errorType: 'file_not_found',
            message: `File not found: ${resolved}`,
        };
    }

    let text: string;
    try {
        text = fs.readFileSync(resolved, 'utf-8');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
            status: 'error',
            errorType: 'file_not_found',
            message: `Cannot read file: ${msg}`,
        };
    }

    // Step 2: Check for MAD tags
    if (!text.includes('//@') && !text.includes('// @')) {
        return {
            status: 'error',
            errorType: 'no_mad_tags',
            message: 'File contains no MAD tags (//@ or // @)',
        };
    }

    // Step 3: Find diagram type declaration
    const diagramType = readDiagramTypeFromText(text);
    const lines = text.split(/\r?\n/);
    const hasDiagramTag = lines.some(l => /\/\/\s*@::/.test(l));
    if (!hasDiagramTag) {
        return {
            status: 'error',
            errorType: 'no_diagram_tag',
            message: 'File has MAD tags but no diagram type declaration (//@::)',
        };
    }

    const prefix = diagramType.split(/[0-9]/)[0];

    // Step 4: Parse all nodes and run MAD structure validation
    const allNodes = filterAllNodesFromText(text);
    const validation = validateDiagram(allNodes, prefix);
    if (!validation.valid) {
        const details = validation.errors.map(
            e => `Line ${e.line + 1}: ${e.message}`
        );
        return {
            status: 'error',
            errorType: 'mad_validation_failed',
            message: `MAD structure validation failed with ${validation.errors.length} error(s)`,
            details,
        };
    }

    // Step 5: Generate Mermaid code via the full pipeline
    let mermaidCode: string;
    try {
        const processedTags = findRelatedTagsFromText(text, prefix, diagramType);
        mermaidCode = generateMermaidDiagram(processedTags, diagramType);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
            status: 'error',
            errorType: 'internal_error',
            message: `Diagram generation failed: ${msg}`,
        };
    }

    // Step 6: Validate Mermaid syntax
    const mermaidValidation = validateMermaidSyntax(mermaidCode);
    if (!mermaidValidation.valid) {
        return {
            status: 'error',
            errorType: 'mermaid_validation_failed',
            message: mermaidValidation.error || 'Mermaid syntax error',
        };
    }

    // Step 7: Run diagram count validation (warnings only — don't fail on these)
    const countIssues = validateDiagramCounts(text, mermaidCode, diagramType);

    // Step 8: Write output file
    try {
        const encoder = new TextEncoder();
        let finalContent = mermaidCode;
        if (countIssues.length > 0) {
            const header =
                `%%% VALIDATION ISSUES (${countIssues.length})\n` +
                countIssues.map(issue => `%%%   - ${issue}`).join('\n') +
                `\n%%% END VALIDATION\n\n`;
            finalContent = header + mermaidCode;
        }
        fs.writeFileSync(OUTPUT_FILE, finalContent, 'utf-8');
    } catch (err) {
        // Non-fatal: still return the generated code
    }

    const durationMs = Date.now() - start;

    return {
        status: 'ok',
        outputFile: OUTPUT_FILE,
        mermaidCode,
        diagramType,
        warnings: countIssues,
        durationMs,
    };
}