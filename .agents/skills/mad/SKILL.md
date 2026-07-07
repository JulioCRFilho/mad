---
name: mad
description: Generates Mermaid diagrams from code using //@ MAD tags, with specific syntax for each diagram type.
---

# MAD Protocol

## ⛔ MANDATORY PROTOCOL — DO NOT SKIP

For **every file** you tag, you MUST complete both phases. The task is INCOMPLETE until validation passes.

### Phase 1: MODIFY & SAVE
Modify the file to insert `//@` tags inline, directly above the code they describe. 1 ID tag per code line maximum.

### Phase 2: VALIDATE via HTTP endpoint
The MAD extension runs an HTTP server on `127.0.0.1` with an auto-assigned port. Discover the port in `/tmp/mad-server.port`, then POST the file path for validation:

```bash
PORT=$(cat /tmp/mad-server.port)
curl -s -X POST "http://127.0.0.1:$PORT/validate" \
  -H "Content-Type: application/json" \
  -d "{\"filePath\": \"/absolute/path/to/file.ts\"}"
```

The response is JSON with `status`, `warnings`, `mermaidCode`, `diagramType`, and `durationMs`.

**Decision flow:**
- `status: "ok"` with empty `warnings: []` → **done**, move to next file
- `status: "ok"` with non-empty warnings → fix the issues, re-write, re-validate
- `status: "error"` → fix the issue described in `message`/`details`, re-write, re-validate

For lightweight validation (warning-only, omit mermaidCode): add `?code=false` to the URL.

### 🚫 FORBIDDEN
- Writing tags without running curl validation
- Declaring done before every file returns `status: "ok"` with empty `warnings: []`

---

## Syntax Quick Reference

| Diagram | Directive | Group | Node | Connection | MAD arrow |
|---------|-----------|-------|------|------------|-----------|
| Flowchart | `//@::graph LR` (or `TD`) | `//@Name` | `//@Name1:State` | `//@Src->Target:Action` | `->` |
| Sequence | `//@::sequenceDiagram` | `//@Name` | `//@Name1:Label` | `//@Src->>Target:Action` | `->>` |
| Class | `//@::classDiagram` | `//@Name` | `//@Name1:Member` | `//@Src-->Target:Relationship` | `-->`, `<\|--`, `*--`, `o--`, `--` |
| State | `//@::stateDiagram-v2` | `//@Name` (state) | `//@Name1:actionId` | `//@Src->Target:Trigger` | `->` |
| ER | `//@::erDiagram` | `//@Name` (table) | — | `//@Src->Target:Relationship` | `->` |

### 🧭 Which diagram type to use in practice

- **`graph` (flowchart)** — Use for 90% of code diagrams: sequential pipelines, branching logic, error paths, data flow. This is the default choice.
- **`classDiagram`** — Use ONLY for structural class/type hierarchies with inheritance and composition relationships. Cannot represent sequential flow.
- **`sequenceDiagram`** — Use for multi-participant interaction flows (API calls, microservices).
- **`stateDiagram-v2`** — Use for finite state machines with transitions.
- **`erDiagram`** — Use for database schemas with entities and relationships.

**Arrow rules**: `->` is the default connector (flowchart, state, ER). `->>` is **exclusive to sequence** — using `->` in sequence diagrams causes `"Target has not been declared"` errors. `-->`, `<|--`, `*--`, `o--`, `--` are **exclusive to class** diagrams.

### Flowchart specifics
- `//@Name` above a class/block → `subgraph` container.
- `//@Name1:State` above code → **node that represents a state or result** of the step.
- `//@Name1.1:State` → sub-step state node.
- `//@Ext_1:State` → **synthetic node** for external systems (APIs, DBs). Required: `_1` suffix.
- `//@Src->Target:Action` → **transition/action** flowing between states.
- `//@->Target:Action` → implicit source (current node context).
- **Semantic labels**: Node labels answer "what is this state/result?". Arrow labels answer "what happens next?".

### Sequence specifics
- `//@Name` above class → participant. External systems used as targets are auto-added.
- Numbered nodes (`//@Client1:Fetch`) create `rect` blocks with step numbering.
- Step numbers in arrows: `//@Src->3>Target:Label` embeds `3` inside the arrow.
- Never use `->` (flowchart syntax) in sequence diagrams.

### Class specifics
- Every class MUST have at least one `//@NameN:Label` entry node. Missing → `Empty class definition`.
- Relationships: `-->` association, `<|--` inheritance, `*--` composition, `o--` aggregation.
- Targets must be declared in the same file.

### State specifics
- Action labels must be simple identifiers (camelCase, no spaces/special chars). Example: `validateData`, NOT `"Etapa 0 — Dados"`.
- Transitions use `//@Src->Target:Trigger` → `Src --> Target: Trigger`. The trigger label is the **action that causes the transition** (e.g. `Submit credentials`, `Auth failed`).

### ER specifics
- Place `//@Name` above `CREATE TABLE` block. Columns are auto-parsed as attributes.
- Default cardinality `||--o{`. One-to-one: label matching `has.one`/`billing`/`shipping`. `"references"` inverts direction.

---

## Critical Rules

1. **Inline placement ONLY**: Tags go directly above the code they describe. NEVER stack all tags in a file header.
2. **1:1 tag-to-code ratio**: Never put two `//@` tags above the same line of code. **Connection tags (`//@Src->Target`) must have actual code between them and the next tag.** If a connection and a state tag are on consecutive lines with no code between them, it triggers a "stacked with other tags" warning. Insert the code line between them or spread them apart.
3. **100% meaningful coverage**: Every method, branch, error path, and external call. See rule 8 for what NOT to tag.
4. **Parser digit-splitting**: Names like `BuildV5` → group `BuildV` + node `5`. Use `//@Steps` + `//@Steps0` (not `//@Step` + `//@Step0`). Avoid trailing underscores before digits.
5. **Known false positive**: `Connections(N) ≠ Diagram(M)` from dedup — report it for fixing.
6. **Self-diagnosis**: `"X_N" belongs to group "X_"` → rename. `Empty class definition` → add entry node. `tGe[a.shape]` → simplify action label.
7. **Labels are semantic**: Node labels (after `:`) describe **states or results** — what the system *is* or *has produced* (e.g. `Data validated`, `Error response`, `Mermaid code generated`). Arrow labels (after `:`) describe **transitions or actions** — what the system *does* (e.g. `Validate structure`, `Call generateDiagram`, `Return error`). A node label answers "what is this?"; an arrow label answers "what happens next?".
8. **What NOT to tag**: Skip tagging: imports (`//@ProcessedNode`), TypeScript interfaces, functions that only delegate to another function with no branching (thin wrappers), single-line getters/setters, and functions with no meaningful internal flow. Tagging these creates empty or near-duplicate subgraphs that clutter the diagram.
9. **Node auto-extraction is unreliable**: When a child node like `//@Name2` has no `:description`, the parser auto-extracts the first keyword from the code below (e.g. `"For"` from a `for` loop, `"If"` from an `if`). **Always provide an explicit `:description` on every numbered child node.** Never rely on auto-extraction.
10. **Auto-inferred edge labels cause duplication**: When MAD auto-infers a parent→child edge, it reuses the child's `:description` as the edge label. If both describe the same thing, the diagram shows identical node and edge labels. **Fix: use explicit `//@Src->Target:ActionLabel` connections where the arrow label (action verb) is distinct from the child node label (result state).** Example: node `MAD structure validated` + edge `→ Validate MAD structure` — NOT both saying the same thing.

---

## 🐛 Known Pitfalls & How to Avoid Them

### Mermaid parse errors from arrow characters in labels
Labels containing `<|--`, `->`, `->>`, or `->N>` crash the Mermaid renderer — the parser interprets them as edge syntax inside label text. **Never put arrow characters in node or edge labels.** Use plain text instead:
- ❌ `"Match step-number arrow (->1>)"` → ✅ `"Match step-number arrow pattern"`
- ❌ `"Match class inline (<\|--)"` → ✅ `"Match class inheritance pattern"`

### Digit-splitting prefix collision (variants)
When creating text-based variants of existing functions (e.g. `findRetroNodeForLine` vs `findRetroNodeForLineFromLines`), the parser splits `findRetroNodeForLineFromLines1` into group `findRetroNodeForLine` + node `FromLines1`. The variant's sub-steps leak into the wrong parent subgraph. **Solution: use completely distinct tag prefixes for variants.**
- ❌ `//@findRetroNodeForLineFromLines1` → ✅ `//@RetroMatcherFromText1`

### JSDoc / string-literal false positives
`//@ID`, `//@->ID`, or `//@::` inside JSDoc comments or JavaScript string literals are parsed as real MAD tags. The parser's `isInsideString` guard catches quoted strings but NOT JSDoc `/** ... */` block comments. **Never write `//@` inside JSDoc descriptions or string literals.**

### Edge self-referencing
Avoid tagging an overridden method with both `//@NameN:Label` AND `//@NameN->NameN:Action` — both resolve to the same ID, creating confusing self-referencing edges. **Instead, tag the inner steps as sub-nodes: `//@NameN.1` through `//@NameN.M`.**

### `For` loops and control keywords
Untagged code below a node whose first keyword is `for`, `if`, `while`, or `switch` causes the parser to auto-extract that keyword as the label. This is another reason to **always provide explicit `:description` labels** (see Rule 9).

---

## Quick Execution Flow

1. Choose diagram type (default: `graph` for pipelines, `classDiagram` only for hierarchies) → 2. Add `//@::[type]` directive → 3. Add inline tags near code with explicit `:description` on every child node → 4. Use explicit `//@Src->Target:ActionLabel` for all connections (avoid auto-inference) → 5. Write file → 6. `curl` the validate endpoint → 7. Check `status` and `warnings` → 8. Fix issues, re-write, re-validate → 9. Next file.

## Examples

Reference implementations are in `.agents/skills/mad/examples/`:
- `01-flowchart-login.ts` — flowchart with subgraphs, synthetic nodes, and branching
- `02-sequence-api.js` — sequence diagram with multiple participants and error handling
- `03-class-diagram-oop.py` — class diagram with inheritance, association, composition
- `04-state-machine-login.js` — state diagram with transitions and error states
- `05-er-database.sql` — ER diagram from SQL table definitions
- `06-sequence-steps.js` — sequence diagram with step-numbered arrows

Read the example file matching your target diagram type before writing tags.