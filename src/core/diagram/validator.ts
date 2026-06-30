import * as vscode from 'vscode';
import { NodeInfo } from './parser';

export interface ValidationError {
    line: number;
    message: string;
    missingId?: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings?: ValidationError[];
}

/**
 * Validates the complete diagram structure:
 * 1. All //@-> point to existing IDs
 * 2. Every sequence node (X.Y) has an immediate parent (X) declared
 * 3. Every entry node (Login1) has a corresponding group (Login)
 * 4. Hierarchy is consistent (e.g. Login1.1.1 → Login1.1 → Login1 → Login)
 */
export function validateDiagram(
    allNodes: NodeInfo[],
    prefix: string
): ValidationResult {
    const errors: ValidationError[] = [];
    const prefixLower = prefix.toLowerCase();

    // Collects ALL declared IDs (not arrows)
    const declaredIds = new Map<string, NodeInfo>();
    for (const node of allNodes) {
        if (!node.isArrow) {
            declaredIds.set(node.id, node);
        }
    }

    const declaredIdSet = new Set(declaredIds.keys());

    // 1. Checks if all //@-> point to existing IDs AND are valid nodes (not arrows)
    for (const node of allNodes) {
        if (node.isArrow) {
            // Skip direct connections (//@Source->Target) - they don't need to be declared
            if (node.id.includes('->')) continue;
            
            // Check if the ID exists
            if (!declaredIdSet.has(node.id)) {
                errors.push({
                    line: node.line,
                    message: `//@->${node.id} points to "${node.id}" which has not been declared. Create //@${node.id} first.`,
                    missingId: node.id
                });
            } else {
                // Check if the pointed ID is a normal node (not an arrow/connection)
                const targetNode = declaredIds.get(node.id);
                if (targetNode && targetNode.isArrow) {
                    errors.push({
                        line: node.line,
                        message: `//@->${node.id} points to "${node.id}" which is a connection/arrow, not a node. //@-> can only point to normal nodes (//@ID), not to other connections.`,
                        missingId: node.id
                    });
                }
            }
        }
    }

    // 2. Validates hierarchy: for each sequence node, checks if the immediate parent exists
    for (const [id, nodeInfo] of declaredIds) {
        // Only validates nodes with dots (sequence nodes)
        if (!id.includes('.')) continue;

        // Find the immediate parent (ex: "Login1.1.1" → parent "Login1.1")
        const lastDot = id.lastIndexOf('.');
        const parentId = id.substring(0, lastDot);

        if (!declaredIdSet.has(parentId)) {
            errors.push({
                line: nodeInfo.line,
                message: `"${id}" has parent "${parentId}" which has not been declared. Create //@${parentId} first.`,
                missingId: parentId
            });
        }
    }

    // 3. Validates that every entry node has a corresponding group
    for (const [id, nodeInfo] of declaredIds) {
        // Identifies entry node: prefix + integer number (e.g. "Login1", "Signup2")
        const entryMatch = id.match(/^([a-zA-Z_]+)\d+$/);
        if (!entryMatch) continue;

        const groupId = entryMatch[1];
        if (!declaredIdSet.has(groupId)) {
            errors.push({
                line: nodeInfo.line,
                message: `"${id}" belongs to group "${groupId}", but the group has not been declared. Create //@${groupId} first.`,
                missingId: groupId
            });
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Finds the parent ID of a numbered item
 */
export function findParentId(id: string, groups: Array<{ id: string }>): string | null {
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