import * as vscode from 'vscode';
import { BaseDiagramCommand } from './shared/base-command';
import { MADDiagramPanel } from '../ui/diagram-panel';
import { DiagramCommandContext, DiagramResult } from './shared/types';
import { findRelatedTagsWithOrder } from './shared/helpers';
import { readDiagramType } from '../diagram/parser';

/**
 * Command handler for Sequence Diagram type.
 * Supports: sequenceDiagram
 *
 * Overrides the default pipeline to ensure messages
 * (//@Source->Target connections) are rendered in the exact order
 * they appear in the file, regardless of grouping by source node.
 */
export class SequenceCommand extends BaseDiagramCommand {
    readonly type = 'sequence';

    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('sequencediagram');
    }

    /**
     * Generates the Mermaid sequence diagram code with hierarchical grouping.
     * Each method (numbered node like Provider1) becomes a rect block
     * with its own step numbering (1.1, 1.2, ..., 2.1, 2.2, ...).
     */
    private generateSequenceMermaid(
        document: vscode.TextDocument,
        prefix: string,
        diagramType: string
    ): string {
        const result = findRelatedTagsWithOrder(document, prefix, diagramType);
        const { nodes, orderedDirectConnections } = result;

        let mermaid = `${diagramType}\n`;
        const participantSet = new Set<string>();
        const participants: string[] = [];

        // First pass: collect all participants (groups) and entry nodes,
        // in the order they appear in the file
        const sortedByLine = [...nodes].sort((a, b) => a.line - b.line);

        for (const tag of sortedByLine) {
            // Collect groups (IDs without numbers)
            if (!/\d/.test(tag.id) && !tag.id.includes('->')) {
                if (!participantSet.has(tag.id)) {
                    participantSet.add(tag.id);
                    participants.push(tag.id);
                }
            }
        }

        // Groups of messages, each group corresponds to a method (numbered node)
        const groups: Array<{
            methodLabel: string;
            methodParticipant: string;
            messages: Array<{ from: string; to: string; label: string }>;
        }> = [];

        // Buffer for connections that appear before their parent method tag
        const pendingConnections: Array<{ from: string; to: string; label: string }> = [];

        let currentGroup: typeof groups[0] | null = null;

        // Second pass: process tags in file order, grouped by method
        for (const tag of sortedByLine) {
            // Process direct connections: //@Source->Target:label or //@Source->>Target:label
            if (tag.id.includes('->')) {
                const [source, target] = tag.id.split('->');
                if (source && target) {
                    const sourceClean = source.trim();
                    const targetClean = target.trim();

                    if (!participantSet.has(sourceClean)) {
                        participantSet.add(sourceClean);
                        participants.push(sourceClean);
                    }
                    if (!participantSet.has(targetClean)) {
                        participantSet.add(targetClean);
                        participants.push(targetClean);
                    }

                    const msg = { from: sourceClean, to: targetClean, label: tag.description || tag.label || 'message' };

                    if (currentGroup) {
                        currentGroup.messages.push(msg);
                    } else {
                        pendingConnections.push(msg);
                    }
                }
                continue;
            }

            // Process numbered nodes (method entries like Provider1)
            if (/\d/.test(tag.id)) {
                const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
                if (groupMatch) {
                    const groupId = groupMatch[1];
                    if (participantSet.has(groupId)) {
                        // Start a new group for this method
                        currentGroup = {
                            methodLabel: tag.label || tag.description || tag.id,
                            methodParticipant: groupId,
                            messages: []
                        };
                        groups.push(currentGroup);

                        // Add self-message for the method entry
                        currentGroup.messages.push({
                            from: groupId,
                            to: groupId,
                            label: tag.label || tag.description || tag.id
                        });

                        // Flush any pending connections into this group
                        for (const pending of pendingConnections) {
                            currentGroup.messages.push(pending);
                        }
                        pendingConnections.length = 0;

                        // Process connections from this numbered node
                        if (tag.connections && tag.connections.length > 0) {
                            for (const conn of tag.connections) {
                                if (!participantSet.has(conn.id)) {
                                    participantSet.add(conn.id);
                                    participants.push(conn.id);
                                }
                                currentGroup.messages.push({
                                    from: groupId,
                                    to: conn.id,
                                    label: conn.label || tag.label
                                });
                            }
                        }
                    }
                }
                continue;
            }

            // Process connections from synthetic nodes (non-numbered nodes with connections)
            if (tag.connections && tag.connections.length > 0) {
                const groupId = tag.id.match(/^([a-zA-Z_]+)/)?.[1];
                if (groupId && participantSet.has(groupId)) {
                    for (const conn of tag.connections) {
                        if (!participantSet.has(conn.id)) {
                            participantSet.add(conn.id);
                            participants.push(conn.id);
                        }
                        const msg = { from: groupId, to: conn.id, label: conn.label || tag.label };
                        if (currentGroup) {
                            currentGroup.messages.push(msg);
                        } else {
                            pendingConnections.push(msg);
                        }
                    }
                }
            }
        }

        // Third pass: direct connections (//@Source->Target) in ORIGINAL FILE ORDER
        for (const conn of orderedDirectConnections) {
            const sourceClean = conn.sourceId;
            const targetClean = conn.targetId;

            if (!participantSet.has(sourceClean)) {
                participantSet.add(sourceClean);
                participants.push(sourceClean);
            }
            if (!participantSet.has(targetClean)) {
                participantSet.add(targetClean);
                participants.push(targetClean);
            }

            const msg = { from: sourceClean, to: targetClean, label: conn.label || 'message' };
            if (currentGroup) {
                currentGroup.messages.push(msg);
            } else {
                pendingConnections.push(msg);
            }
        }

        // If there are pending connections that never got a method group,
        // create a standalone group for them
        if (pendingConnections.length > 0) {
            const firstPending = pendingConnections[0];
            const standaloneGroup = {
                methodLabel: firstPending.label,
                methodParticipant: firstPending.from,
                messages: [...pendingConnections]
            };
            groups.push(standaloneGroup);
        }

        // Generate Mermaid code
        for (const p of participants) {
            mermaid += `    participant ${p}\n`;
        }

        // Render groups with rect blocks for visual hierarchy
        let methodCounter = 0;
        for (const group of groups) {
            methodCounter++;
            const color = methodCounter % 2 === 0 ? '191, 223, 255' : '220, 240, 255';
            mermaid += `    rect rgb(${color})\n`;
            mermaid += `        Note over ${group.methodParticipant}: ${methodCounter}. ${group.methodLabel}\n`;

            let stepCounter = 0;
            for (const msg of group.messages) {
                stepCounter++;
                mermaid += `        ${msg.from}->>${msg.to}: ${methodCounter}.${stepCounter} ${msg.label}\n`;
            }

            mermaid += `    end\n`;
        }

        return mermaid;
    }

    /**
     * Overrides execute() to use the correct connection order.
     */
    execute(context: DiagramCommandContext): DiagramResult {
        const { document, prefix, extensionUri } = context;

        const diagramType = this.readDiagramType(document);

        // MAD validation
        const validation = this.validateMAD(document, prefix);
        if (!validation.valid) {
            return { success: false, errorMessage: validation.error };
        }

        // Generate Mermaid code with correct ordering
        const mermaidCode = this.generateSequenceMermaid(document, prefix, diagramType);

        // Pre-display hook
        const processedCode = this.beforeDisplay(mermaidCode, diagramType);

        // Mermaid validation
        const mermaidValidation = this.validateMermaid(processedCode, diagramType);
        if (!mermaidValidation.valid) {
            return {
                success: false,
                errorMessage: `Mermaid syntax error:\n${mermaidValidation.error}`
            };
        }

        // Display diagram
        this.displayDiagram(extensionUri, processedCode);

        return { success: true };
    }
}