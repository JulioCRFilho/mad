//@::graph TD

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
    ValidateResponse,
} from './types';
import { filterAllNodesFromText, isInsideString, readDiagramTypeFromText } from '../diagram/parser';
import { validateDiagram } from '../diagram/validator';
import { validateMermaidSyntax } from '../diagram/mermaid-validator';
import { generateMermaidDiagram } from '../diagram/generator';
import {
    validateDiagramCounts,
} from '../commands/shared/validation';
import { findRelatedTagsFromText } from '../commands/shared/helpers';

/**
 * Runs the full validation and generation pipeline for a file path.
 * Returns structured results suitable for the HTTP response.
 */
//@ValidateFile
export function validateFile(filePath: string): ValidateResponse {
    const start = Date.now();

    // Step 1: Resolve and check file existence
    //@ValidateFile1:File path resolved and verified
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
        //@ValidateFile1->Ext_1:File not found — return error
        return {
            status: 'error',
            errorType: 'file_not_found',
            message: `File not found: ${resolved}`,
        };
    }

    //@ValidateFile1.1:File content read
    let text: string;
    try {
        text = fs.readFileSync(resolved, 'utf-8');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        //@ValidateFile1.1->Ext_1:Cannot read file — return error
        return {
            status: 'error',
            errorType: 'file_not_found',
            message: `Cannot read file: ${msg}`,
        };
    }

    // Step 2: Check for MAD tags
    //@ValidateFile1.1->ValidateFile2:Check for MAD tags in text
    const hasRawTags = text.includes('//@') || text.includes('// @');
    //@ValidateFile2:MAD tags present
    if (!hasRawTags) {
        //@ValidateFile2->Ext_1:No MAD tags — return error
        return {
            status: 'error',
            errorType: 'no_mad_tags',
            message: 'File contains no MAD tags (//@ or // @)',
        };
    }

    // Step 3: Find diagram type declaration
    //@ValidateFile2->ValidateFile3:Read diagram type directive
    //@ValidateFile3:Diagram type identified
    const diagramType = readDiagramTypeFromText(text);
    const lines = text.split(/\r?\n/);
    //@ValidateFile3.1:String-literal false positive guarded
    const hasDiagramTag = lines.some(l => {
        const match = l.match(/\/\/\s*@::/);
        return match && !isInsideString(l, match.index!);
    });
    if (!hasDiagramTag) {
        //@ValidateFile3->Ext_1:No diagram type declaration — return error
        return {
            status: 'error',
            errorType: 'no_diagram_tag',
            message: 'File has MAD tags but no diagram type declaration (//@::)',
        };
    }

    const prefix = diagramType.split(/[0-9]/)[0];

    // Step 4: Parse all nodes and run MAD structure validation
    //@ValidateFile3->ValidateFile4:Parse and validate MAD structure
    //@ValidateFile4:MAD structure validated
    const allNodes = filterAllNodesFromText(text);
    const validation = validateDiagram(allNodes, prefix);
    if (!validation.valid) {
        const details = validation.errors.map(
            e => `Line ${e.line + 1}: ${e.message}`
        );
        //@ValidateFile4->Ext_1:MAD validation failed — return errors
        return {
            status: 'error',
            errorType: 'mad_validation_failed',
            message: `MAD structure validation failed with ${validation.errors.length} error(s)`,
            details,
        };
    }

    // Step 5: Generate Mermaid code via the full pipeline
    //@ValidateFile4->ValidateFile5:Generate Mermaid code
    //@ValidateFile5:Mermaid code generated
    let mermaidCode: string;
    try {
        const processedTags = findRelatedTagsFromText(text, prefix, diagramType);
        mermaidCode = generateMermaidDiagram(processedTags, diagramType);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        //@ValidateFile5->Ext_1:Generation failed — return error
        return {
            status: 'error',
            errorType: 'internal_error',
            message: `Diagram generation failed: ${msg}`,
        };
    }

    // Step 6: Validate Mermaid syntax
    //@ValidateFile5->ValidateFile6:Validate Mermaid syntax
    //@ValidateFile6:Mermaid syntax validated
    const mermaidValidation = validateMermaidSyntax(mermaidCode);
    if (!mermaidValidation.valid) {
        //@ValidateFile6->Ext_1:Mermaid validation failed — return error
        return {
            status: 'error',
            errorType: 'mermaid_validation_failed',
            message: mermaidValidation.error || 'Mermaid syntax error',
        };
    }

    // Step 7: Run diagram count validation
    //@ValidateFile6->ValidateFile7:Run count validation
    //@ValidateFile7:Count validation complete
    const countIssues = validateDiagramCounts(text, mermaidCode, diagramType);

    const durationMs = Date.now() - start;

    //@ValidateFile7->ValidateFile8:Return HTTP response JSON
    //@ValidateFile8:Response returned to caller
    return {
        status: 'ok',
        mermaidCode,
        diagramType,
        warnings: countIssues,
        durationMs,
    };
}