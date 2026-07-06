---
name: mad
description: Generates Mermaid diagrams from code using //@ MAD tags, with specific syntax for each diagram type.
---

# MAD Protocol

## ⛔ MANDATORY PROTOCOL — DO NOT SKIP

For **every file** you tag, you MUST complete both phases. The task is INCOMPLETE until validation passes.

### Phase 1: MODIFY & SAVE
Use `write_to_file` or `replace_in_file` to insert `//@` tags inline, directly above the code they describe. 1 ID tag per code line maximum. The write tool auto-saves, triggering diagram generation at `/tmp/mad-diagram.mermaid`.

### Phase 2: VALIDATE
Run `cat /tmp/mad-diagram.mermaid`. If `%%% VALIDATION ISSUES` appears in the header, fix the tags and re-write (loop back to Phase 1). Repeat until clean.

### 🚫 FORBIDDEN
- Writing tags without running `cat /tmp/mad-diagram.mermaid`
- Batching files (shared output file overwrites previous results)
- Declaring done before every file passes validation

---

## Syntax Quick Reference

| Diagram | Directive | Group | Node | Connection | MAD arrow |
|---------|-----------|-------|------|------------|-----------|
| Flowchart | `//@::graph LR` (or `TD`) | `//@Name` | `//@Name1:Label` | `//@Src->Target:Label` | `->` |
| Sequence | `//@::sequenceDiagram` | `//@Name` | `//@Name1:Label` | `//@Src->>Target:Label` | `->>` |
| Class | `//@::classDiagram` | `//@Name` | `//@Name1:Label` | `//@Src-->Target:Label` | `-->`, `<\|--`, `*--`, `o--`, `--` |
| State | `//@::stateDiagram-v2` | `//@Name` (state) | `//@Name1:actionId` | `//@Src->Target:Label` | `->` |
| ER | `//@::erDiagram` | `//@Name` (table) | — | `//@Src->Target:Label` | `->` |

**Arrow rules**: `->` is the default connector (flowchart, state, ER). `->>` is **exclusive to sequence** — using `->` in sequence diagrams causes `"Target has not been declared"` errors. `-->`, `<|--`, `*--`, `o--`, `--` are **exclusive to class** diagrams.

### Flowchart specifics
- `//@Name` above a class → `subgraph`. `//@Name1:Label` above a method → node inside it.
- `//@Name1.1:Label` → sub-step node.
- `//@Ext_1:Label` → **synthetic node** for external systems (APIs, DBs). Required: `_1` suffix.
- `//@->Target:Label` → implicit source (current node context).

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
- Transitions: `//@Src->Target:Label` → `Src --> Target: Label`.

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
6. **Self-diagnosis**: `"X_N" belongs to group "X_"` → rename. `Empty class definition` → add entry node. `tGe[a.shape]` → simplify action label. Output starts with `ERROR:` → fix tags.

---

## Quick Execution Flow

1. Choose diagram type → 2. Add `//@::[type]` directive → 3. Add inline tags near code → 4. Write file (auto-saves, triggers generator) → 5. `cat /tmp/mad-diagram.mermaid` → 6. Fix issues, re-write, re-validate → 7. Next file.

## Examples

Reference implementations are in `.agents/skills/mad/examples/`:
- `01-flowchart-login.ts` — flowchart with subgraphs, synthetic nodes, and branching
- `02-sequence-api.js` — sequence diagram with multiple participants and error handling
- `03-class-diagram-oop.py` — class diagram with inheritance, association, composition
- `04-state-machine-login.js` — state diagram with transitions and error states
- `05-er-database.sql` — ER diagram from SQL table definitions
- `06-sequence-steps.js` — sequence diagram with step-numbered arrows

Read the example file matching your target diagram type before writing tags.
