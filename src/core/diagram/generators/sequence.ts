//@::graph TD

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
    tag?: ProcessedNode;
    groupId?: string;
    from?: string;
    to?: string;
    label?: string;
    stepNumber?: string;
}

//@sequenceGenerator
export const sequenceGenerator: DiagramGenerator = {
    type: 'sequenceDiagram',

    matches(diagramType: string): boolean {
        return diagramType.toLowerCase().startsWith('sequencediagram');
    },

    //@sequenceGenerator1:Initialise — prepare participant set and event stream
    generate(tags: ProcessedNode[], diagramType: string): string {
        let mermaid = '';
        const participantSet = new Set<string>();
        const participants: string[] = [];

        //@sequenceGenerator1->sequenceGenerator2:Collect group participants from tags
        //@sequenceGenerator2:Participants collected from group tags
        for (const tag of tags) {
            if (!/\d/.test(tag.id) && !tag.id.includes('->')) {
                if (!participantSet.has(tag.id)) {
                    participantSet.add(tag.id);
                    participants.push(tag.id);
                }
            }
        }

        const sortedByLine = [...tags].sort((a, b) => a.line - b.line);

        //@sequenceGenerator2->sequenceGenerator3:Build unified event stream
        //@sequenceGenerator3:Unified entry/connection events built
        const events: Event[] = [];

        for (const tag of sortedByLine) {
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
                        line: tag.line, kind: 'connection',
                        from: sourceClean, to: targetClean,
                        label: tag.description || tag.label || 'message',
                        stepNumber: tag.stepNumber
                    });
                }
                continue;
            }

            if (/\d/.test(tag.id)) {
                const groupMatch = tag.id.match(/^([a-zA-Z_]+)\d+/);
                if (groupMatch) {
                    const groupId = groupMatch[1];
                    if (participantSet.has(groupId)) {
                        events.push({ line: tag.line, kind: 'entry', tag, groupId });

                        if (tag.connections && tag.connections.length > 0) {
                            for (const conn of tag.connections) {
                                if (!participantSet.has(conn.id)) {
                                    participantSet.add(conn.id);
                                    participants.push(conn.id);
                                }
                                events.push({
                                    line: conn.line ?? tag.line, kind: 'connection',
                                    from: groupId, to: conn.id,
                                    label: conn.label || tag.label,
                                    stepNumber: conn.stepNumber
                                });
                            }
                        }
                    }
                }
                continue;
            }

            if (tag.connections && tag.connections.length > 0) {
                const groupId = tag.id.match(/^([a-zA-Z_]+)/)?.[1];
                if (groupId && participantSet.has(groupId)) {
                    for (const conn of tag.connections) {
                        if (!participantSet.has(conn.id)) {
                            participantSet.add(conn.id);
                            participants.push(conn.id);
                        }
                        events.push({
                            line: conn.line ?? tag.line, kind: 'connection',
                            from: groupId, to: conn.id,
                            label: conn.label || tag.label,
                            stepNumber: conn.stepNumber
                        });
                    }
                }
            }
        }

        //@sequenceGenerator3->sequenceGenerator4:Sort events by line number
        //@sequenceGenerator4:Events sorted (entries before connections)
        events.sort((a, b) => {
            if (a.line !== b.line) return a.line - b.line;
            if (a.kind === b.kind) return 0;
            return a.kind === 'entry' ? -1 : 1;
        });

        //@sequenceGenerator4->sequenceGenerator5:Build message groups from events
        //@sequenceGenerator5:Groups populated with entry/connection events
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

                for (const pending of pendingConnections) {
                    currentGroup.messages.push(pending);
                }
                pendingConnections.length = 0;
            } else if (ev.kind === 'connection') {
                const msg: Message = { from: ev.from!, to: ev.to!, label: ev.label || 'message', stepNumber: ev.stepNumber };
                if (currentGroup) {
                    currentGroup.messages.push(msg);
                } else {
                    pendingConnections.push(msg);
                }
            }
        }

        //@sequenceGenerator5->sequenceGenerator6:Finalize orphan connections
        //@sequenceGenerator6:Orphan connections wrapped into own group
        if (pendingConnections.length > 0) {
            const firstPending = pendingConnections[0];
            groups.push({
                methodLabel: firstPending.label,
                methodParticipant: firstPending.from,
                messages: [...pendingConnections]
            });
        }

        //@sequenceGenerator6->sequenceGenerator7:Compute per-group participant sets
        //@sequenceGenerator7:Participant sets ready for rendering
        const groupParticipants: Set<string>[] = groups.map(group => {
            const used = new Set<string>();
            used.add(group.methodParticipant);
            for (const msg of group.messages) {
                used.add(msg.from);
                used.add(msg.to);
            }
            return used;
        });

        //@sequenceGenerator7->sequenceGenerator8:Render sequenceDiagram blocks
        //@sequenceGenerator8:Rendering complete — Mermaid returned
        let methodCounter = 0;
        for (const group of groups) {
            methodCounter++;

            if (methodCounter > 1) {
                mermaid += `\n---\n`;
            }

            mermaid += `sequenceDiagram\n`;

            const used = groupParticipants[methodCounter - 1];
            for (const p of participants) {
                if (used.has(p)) {
                    mermaid += `    participant ${p}\n`;
                }
            }

            mermaid += `    Note over ${group.methodParticipant}: ${group.methodLabel}\n`;

            for (const msg of group.messages) {
                mermaid += `    ${msg.from}->>${msg.to}: ${msg.label}\n`;
            }
        }

        return mermaid;
    }
};