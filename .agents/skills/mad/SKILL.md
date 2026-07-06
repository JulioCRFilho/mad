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
2. **1:1 tag-to-code ratio**: Never put two `//@` tags above the same line of code.
3. **100% meaningful coverage**: Every method, branch, error path, and external call. Skip only pure data structs and trivial one-liners.
4. **Parser digit-splitting**: Names like `BuildV5` → group `BuildV` + node `5`. Use `//@Steps` + `//@Steps0` (not `//@Step` + `//@Step0`). Avoid trailing underscores before digits.
5. **Known false positive**: `Connections(N) ≠ Diagram(M)` from dedup — report it for fixing.
6. **Self-diagnosis**: `"X_N" belongs to group "X_"` → rename. `Empty class definition` → add entry node. `tGe[a.shape]` → simplify action label.
7. **Labels are semantic**: Node labels (after `:`) describe **states or results** — what the system *is* or *has produced* (e.g. `Data validated`, `Error response`, `Mermaid code generated`). Arrow labels (after `:`) describe **transitions or actions** — what the system *does* (e.g. `Validate structure`, `Call generateDiagram`, `Return error`). A node label answers "what is this?"; an arrow label answers "what happens next?".

---

## Quick Execution Flow

1. Choose diagram type → 2. Add `//@::[type]` directive → 3. Add inline tags near code → 4. Write file → 5. `curl` the validate endpoint → 6. Check `status` and `warnings` → 7. Fix issues, re-write, re-validate → 8. Next file.

## Examples

Reference implementations are in `.agents/skills/mad/examples/`:
- `01-flowchart-login.ts` — flowchart with subgraphs, synthetic nodes, and branching
- `02-sequence-api.js` — sequence diagram with multiple participants and error handling
- `03-class-diagram-oop.py` — class diagram with inheritance, association, composition
- `04-state-machine-login.js` — state diagram with transitions and error states
- `05-er-database.sql` — ER diagram from SQL table definitions
- `06-sequence-steps.js` — sequence diagram with step-numbered arrows

Read the example file matching your target diagram type before writing tags.