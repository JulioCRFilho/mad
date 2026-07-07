//@::graph TD

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
//@validateDiagram
export function validateDiagram(
    allNodes: NodeInfo[],
    prefix: string
): ValidationResult {
    const errors: ValidationError[] = [];
    const prefixLower = prefix.toLowerCase();

    //@validateDiagram1:Collect all non-arrow IDs as declared
    const declaredIds = new Map<string, NodeInfo>();
    for (const node of allNodes) {
        if (!node.isArrow) {
            declaredIds.set(node.id, node);
        }
    }

    const declaredIdSet = new Set(declaredIds.keys());

    //@validateDiagram1->validateDiagram2:Check forward refs point to valid IDs
    //@validateDiagram2:Forward references validated
    for (const node of allNodes) {
        if (node.isArrow) {
            if (node.id.includes('->')) continue;
            
            if (!declaredIdSet.has(node.id)) {
                errors.push({
                    line: node.line,
                    message: `//@->${node.id} points to "${node.id}" which has not been declared. Create //@${node.id} first.`,
                    missingId: node.id
                });
            } else {
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

    //@validateDiagram2->validateDiagram3:Validate sequence hierarchy (X.Y has parent X)
    //@validateDiagram3:Sequence hierarchy validated
    for (const [id, nodeInfo] of declaredIds) {
        if (!id.includes('.')) continue;

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

    //@validateDiagram3->validateDiagram4:Validate entry nodes belong to a group
    //@validateDiagram4:Entry group membership validated
    for (const [id, nodeInfo] of declaredIds) {
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

    //@validateDiagram4->validateDiagram5:Return validation result
    //@validateDiagram5:Result returned (valid from errors length)
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Finds the parent ID of a numbered item.
 * First check dot hierarchy, then group prefix match.
 */
//@findParentId
export function findParentId(id: string, groups: Array<{ id: string }>): string | null {
    //@findParentId1:Check dot-separated hierarchy
    const lastDotIndex = id.lastIndexOf('.');
    if (lastDotIndex > 0) {
        const parentId = id.substring(0, lastDotIndex);
        return parentId;
    }

    //@findParentId1->findParentId2:Fallback — check group prefix match
    //@findParentId2:Parent found (or null)
    const match = id.match(/^([a-zA-Z_]+)\d+$/);
    if (match) {
        const groupId = match[1];
        if (groups.some(g => g.id === groupId)) {
            return groupId;
        }
    }

    return null;
}