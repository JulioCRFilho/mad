/**
 * Generates a sequence diagram with function-based visual grouping.
 *
 * Each function (numbered node like Provider1) becomes a visually separated
 * group using Mermaid `rect` blocks with border-only styling.
 * Step numbering restarts from 1 within each group for independent flows.
 *
 * IMPORTANT: Connections whose explicit source is a GROUP name (e.g.
 * `//@Storage->1>S3:Upload with ACL`, where "Storage" is the group, not the
 * "Storage1" entry) get merged by the tag pipeline into the bare group node's
 * `.connections` array (matched by id). Since the group tag typically appears
 * BEFORE its own numbered entry tag in the file, iterating tags in their own
 * declaration order would misattach these connections to whatever function
 * group was active at that point (usually the PREVIOUS function).
 *
 * To avoid this, we don't trust the tag's own line when placing a connection —
 * we use the connection's own recorded line (see ProcessedNode.connections[].line)
 * to build a single, correctly time-ordered stream of "start function" and
 * "message" events, then assign each message to whichever function group was
 * active at that connection's own line.
 */
import { ProcessedNode } from '../parser';
import { DiagramGenerator } from './types';

interface Message {
    from: string;
    to: string;
    label: string;
    stepNumber?: string;
}

interface Group {
    methodLabel: string;
    methodParticipant: string;
    messages: Message[];
}

interface Event {
    line: number;
    kind: 'entry' | 'connection';
    // For 'entry' events
    tag?: ProcessedNode;
    groupId?: string;
    // For 'connection' events
    from?: string;
    to?: string;
    label?: string;
    stepNumber?: string;
}

export const sequenceGenerator: DiagramGenerator = {
    type: 'sequenceDiagram',
    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('sequencediagram');
    },
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = '';
        const participantSet = new Set<string>();
        const participants: string[] = [];

        // First pass: collect all participants (groups) — ids without digits and without '->'
        for (const tag of tags) {
            if (!/\d/.test(tag.id) && !tag.id.includes('->')) {
                if (!participantSet.has(tag.id)) {
                    participantSet.add(tag.id);
                    participants.push(tag.id);
                }
            }
        }

        const sortedByLine = [...tags].sort((a, b) => a.line - b.line);

        // Build a unified list of events: method-entry starts and messages.
        // Messages use their OWN recorded line (conn.line) when available,
        // so they are correctly ordered relative to method-entry events
        // regardless of which tag they were merged onto.
        const events: Event[] = [];

        for (const tag of sortedByLine) {
            // Tags whose id itself contains '->' never appear standalone here
            // (they are merged into other nodes' .connections by the pipeline),
            // but guard defensively in case that ever changes.
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
                    events.push({
                        line: tag.line,
                        kind: 'connection',
                        from: sourceClean,
                        to: targetClean,
                        label: tag.description || tag.label || 'message',
                        stepNumber: tag.stepNumber
                    });
                }
                continue;
            }

            // Numbered nodes (method entry points like Provider1) start a new group
            if (/\d/.test(tag.id)) {
                const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
                if (groupMatch) {
                    const groupId = groupMatch[1];
                    if (participantSet.has(groupId)) {
                        events.push({
                            line: tag.line,
                            kind: 'entry',
                            tag,
                            groupId
                        });

                        // Connections attached directly to this entry tag
                        // (e.g. forward-pointer arrays resolved to this entry)
                        if (tag.connections && tag.connections.length > 0) {
                            for (const conn of tag.connections) {
                                if (!participantSet.has(conn.id)) {
                                    participantSet.add(conn.id);
                                    participants.push(conn.id);
                                }
                                events.push({
                                    line: conn.line ?? tag.line,
                                    kind: 'connection',
                                    from: groupId,
                                    to: conn.id,
                                    label: conn.label || tag.label,
                                    stepNumber: conn.stepNumber
                                });
                            }
                        }
                    }
                }
                continue;
            }

            // Group (bare) nodes — connections merged onto them (e.g. from
            // `//@GroupName->N>Target:Label`) belong to whichever method group
            // is active at the connection's OWN line, not the group tag's line.
            if (tag.connections && tag.connections.length > 0) {
                const groupId = tag.id.match(/^([a-zA-Z_]+)/)?.[1];
                if (groupId && participantSet.has(groupId)) {
                    for (const conn of tag.connections) {
                        if (!participantSet.has(conn.id)) {
                            participantSet.add(conn.id);
                            participants.push(conn.id);
                        }
                        events.push({
                            line: conn.line ?? tag.line,
                            kind: 'connection',
                            from: groupId,
                            to: conn.id,
                            label: conn.label || tag.label,
                            stepNumber: conn.stepNumber
                        });
                    }
                }
            }
        }

        // Sort by line; on ties, entry events come first so a method group
        // starts before any message that shares its line.
        events.sort((a, b) => {
            if (a.line !== b.line) return a.line - b.line;
            if (a.kind === b.kind) return 0;
            return a.kind === 'entry' ? -1 : 1;
        });

        const groups: Group[] = [];
        const pendingConnections: Message[] = [];
        let currentGroup: Group | null = null;

        for (const ev of events) {
            if (ev.kind === 'entry' && ev.tag && ev.groupId) {
                const tag = ev.tag;
                currentGroup = {
                    methodLabel: tag.label || tag.description || tag.id,
                    methodParticipant: ev.groupId,
                    messages: []
                };
                groups.push(currentGroup);

                // Flush any pending connections that arrived before we knew the group
                for (const pending of pendingConnections) {
                    currentGroup.messages.push(pending);
                }
                pendingConnections.length = 0;
            } else if (ev.kind === 'connection') {
                const msg: Message = {
                    from: ev.from!,
                    to: ev.to!,
                    label: ev.label || 'message',
                    stepNumber: ev.stepNumber
                };
                if (currentGroup) {
                    currentGroup.messages.push(msg);
                } else {
                    pendingConnections.push(msg);
                }
            }
        }

        // If there are pending connections that never got a method group,
        // create a standalone group for them
        if (pendingConnections.length > 0) {
            const firstPending = pendingConnections[0];
            groups.push({
                methodLabel: firstPending.label,
                methodParticipant: firstPending.from,
                messages: [...pendingConnections]
            });
        }

        // Pre-compute which participants each group actually uses
        const groupParticipants: Set<string>[] = groups.map(group => {
            const used = new Set<string>();
            used.add(group.methodParticipant);
            for (const msg of group.messages) {
                used.add(msg.from);
                used.add(msg.to);
            }
            return used;
        });

        // Render each group as an independent sequenceDiagram, separated by ---
        let methodCounter = 0;
        for (const group of groups) {
            methodCounter++;

            // Only add the `---` separator between diagrams (not for the first real diagram
            // since the initial `diagramType\n` already acts as the header)
            if (methodCounter > 1) {
                mermaid += `\n---\n`;
            }

            mermaid += `sequenceDiagram\n`;

            // Render only the participants this group uses (in consistent order)
            const used = groupParticipants[methodCounter - 1];
            for (const p of participants) {
                if (used.has(p)) {
                    mermaid += `    participant ${p}\n`;
                }
            }

            // Section header
            mermaid += `    Note over ${group.methodParticipant}: ${group.methodLabel}\n`;

            for (const msg of group.messages) {
                mermaid += `    ${msg.from}->>${msg.to}: ${msg.label}\n`;
            }
        }

        return mermaid;
    }
};
