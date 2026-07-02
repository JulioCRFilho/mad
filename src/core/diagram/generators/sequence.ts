import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

export const sequenceGenerator: DiagramGenerator = {
    type: 'sequenceDiagram',
    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('sequencediagram');
    },
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = `${diagramType}\n`;
        const participantSet = new Set<string>();
        const participants: string[] = [];

        // First pass: collect all participants (groups)
        for (const tag of tags) {
            if (!/\d/.test(tag.id) && !tag.id.includes('->')) {
                if (!participantSet.has(tag.id)) {
                    participantSet.add(tag.id);
                    participants.push(tag.id);
                }
            }
        }

        // Second pass: process tags in file order, grouped by method
        const sortedByLine = [...tags].sort((a, b) => a.line - b.line);

        // Groups of messages, each group corresponds to a method (numbered node)
        const groups: Array<{
            methodLabel: string;
            methodParticipant: string;
            messages: Array<{ from: string; to: string; label: string }>;
        }> = [];

        // Buffer for connections that appear before their parent method tag
        const pendingConnections: Array<{ from: string; to: string; label: string }> = [];

        let currentGroup: typeof groups[0] | null = null;

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
                        // Belongs to the current method group
                        currentGroup.messages.push(msg);
                    } else {
                        // Buffer until we know which method this belongs to
                        pendingConnections.push(msg);
                    }
                }
                continue;
            }

            // Process numbered nodes (method entries like Provider1)
            // These represent method entry points and start a new group
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
                        // (e.g. extra connections from forward pointers associated with this node)
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

        // Render participants
        for (const p of participants) mermaid += `    participant ${p}\n`;

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
};