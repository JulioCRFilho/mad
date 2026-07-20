# Implementation Plan

[Overview]
Add a validation rule that ensures each numbered/sequential node in process-oriented diagrams (flowchart, sequence, state) has at least one connection to another node, preventing orphan nodes that would appear disconnected in the generated diagram.

The task requires extending the existing validation pipeline to catch a specific class of issues: sequential (numbered) nodes that are declared but never referenced by any connection tag. In the current system, `findMissingConnections` only checks whether the diagram has zero connections total — it doesn't validate individual node connectivity. Flowchart, sequence, and state diagrams represent flows/processes where each numbered step should be connected; class and ER diagrams are exempt because standalone classes/entities are valid.

[Types]
One new function signature, no new types needed.

New function: `findSequentialNodesWithoutConnections`
```
function findSequentialNodesWithoutConnections(allTags: TagInfo[], diagramType: string): string[]
```
- Input: array of parsed tag info, diagram type string
- Output: array of human-readable issue strings (empty if all sequential nodes have connections)
- Behavior: For flowchart/graph/sequence/state diagrams, checks each numbered node (id containing digits) to see if any connection tag references it as source or target. Returns issues describing which sequential nodes lack connections.

[Files]
Single file modification to `src/core/commands/shared/validation.ts`.

- **Modified file**: `src/core/commands/shared/validation.ts`
  - Add new function `findSequentialNodesWithoutConnections`
  - Call it from `validateDiagramCounts` alongside the existing hygiene checks

No new files, no deleted files, no configuration changes.

[Functions]
Single new function added, one call site modified.

**New function**: `findSequentialNodesWithoutConnections`
- File: `src/core/commands/shared/validation.ts`
- Signature: `(allTags: TagInfo[], diagramType: string): string[]`
- Purpose: Checks that every numbered node (id containing digits) in process-oriented diagrams is referenced by at least one connection tag (either as source or target). Returns descriptive error messages for any disconnected sequential nodes.
- Logic:
  1. Determine if the diagram type requires sequential node connectivity (flowchart/graph, sequenceDiagram, stateDiagram-v2 → yes; classDiagram, erDiagram → no)
  2. If not required, return empty array
  3. Collect all sequential nodes: tags where `!t.isConnection && /\d/.test(t.id)` (i.e., entry nodes like `Login1`, sequence nodes like `Entry1.1`)
  4. Collect all connection targets: iterate connection tags, collecting all `targetIds` and any source IDs extracted from `id.includes('->')`
  5. Also add parent IDs from sequence node hierarchy (e.g., `Entry1.1` implies `Entry1` is a parent that generates an automatic edge)
  6. For each sequential node not in the connected set, push an issue string to the result
  7. Return issues

**Modified function**: `validateDiagramCounts`
- File: `src/core/commands/shared/validation.ts`
- Location: After the existing hygiene checks (around line 568)
- Change: Add `issues.push(...findSequentialNodesWithoutConnections(allTags, diagramType));`

No functions removed.

[Classes]
No class modifications required.

[Dependencies]
No dependency changes required.

[Testing]
Existing tests must continue passing; the new validation will produce warnings (comments prepended to the mermaid output) only when disconnected sequential nodes exist, which should not occur in existing examples.

Test strategy:
- Run `npm run compile && node --test test/mad-outputs.test.mjs` to verify existing tests pass
- Manually verify that creating a disconnected node (e.g., `//@Orphan1` with no connection) triggers the new validation

[Implementation Order]
Single atomic change to one file.

1. Add the `findSequentialNodesWithoutConnections` function to `src/core/commands/shared/validation.ts`
2. Add the call to this function in `validateDiagramCounts`
3. Compile and run existing tests to confirm no regressions