---
name: mad
description: Mermaid Auto-Doccing — guides the AI agent in software development with MAD tags, generating Mermaid diagrams from //@ comments in code.
---

# MAD — Mermaid Auto-Doccing

## What it is

VS Code extension that transforms `//@` comments into Mermaid diagrams automatically.

## How it works

1. You edit `//@` tags in the code
2. Save the file (Ctrl+S / Cmd+S)
3. Extension detects the save, re-parses everything, regenerates the diagram
4. Diagram is saved to `/tmp/mad-diagram.mermaid`
5. You validate the result

**There are no manual commands.** Any tag modification + save = updated diagram.

## Fundamental rules

1. **First line**: `//@::DiagramType` (ex: `//@::graph LR`)
2. **`//@` comments**: become nodes or connections
3. **Comments without `@`**: REMOVE (never use plain `//`)
4. **Documentation in code**: NEVER create external `.md` files

## Diagram types

```typescript
//@::graph LR          // Flowchart (left → right)
//@::graph TD          // Flowchart (top → bottom)
//@::sequenceDiagram   // Sequence
//@::classDiagram      // Classes
//@::stateDiagram-v2   // States
//@::erDiagram         // Entity-relationship
```

## Naming system

### Groups (without numbers)
```typescript
//@Auth
```
Become: `subgraph` (flowchart), `class` (classDiagram), `participant` (sequence), `state` (state), entity (ER)

### Numbered nodes
```typescript
//@Auth1:Label           // Entry node (level 1)
//@Auth1.1:Label         // Sub-step (level 2)
//@Auth1.1.2:Label       // Sub-sub-step (level 3)
//@Node_1:Label          // Synthetic node (underscore)
```

**Numbering rules:**
- `Name1` → entry node
- `Name1.1` → sequence of previous
- `Name1.1.1` → third level
- `Name_1` → synthetic (outside subgraphs)
- Automatically sorted by number

## Supported tags

### Nodes
```typescript
//@Group                    // Simple group
//@Group1:Label             // Entry node with label
//@Group1.1:Label           // Sub-step
//@Node_1:Label             // Synthetic node
```

### Implicit connections (source = current context)
```typescript
//@->Target:Label           // Inside method, connects to node above
```

### Explicit connections (source defined)
```typescript
//@Source->Target:Label     // With explicit source
//@Source-->Target:Label    // Same as above (--> is alias)
```

### ClassDiagram (UML arrows)
```typescript
//@Source-->Target:Label    // Association (solid line)
//@Source<|--Target:Label   // Inheritance (empty triangle)
//@Source*--Target:Label    // Composition (filled diamond)
//@Sourceo--Target:Label    // Aggregation (empty diamond)
//@<|--Target:Label         // Inheritance (no source, uses parent group)
//@*--Target:Label          // Composition (no source, uses parent group)
//@o--Target:Label          // Aggregation (no source, uses parent group)
```

### SequenceDiagram
```typescript
//@->>Target:Label          // Double arrow (->>)
```

## Where to place each tag

| Tag | Position | Example |
|-----|----------|---------|
| `//@Group` | Above class/function | `//@Auth` above `class AuthService` |
| `//@Group1:Label` | Above method | `//@Auth1:Login` above `async login()` |
| `//@Group1.1:Label` | Inside method | `//@Auth1.1:Verify` inside `login()` |
| `//@->Target:Label` | Inside method, at call point | `//@->Dashboard:Show` where dashboard is called |
| `//@Source->Target:Label` | Between groups (file level) | `//@Entry->Auth:Main flow` |

## Golden rules

1. **Tags must lead to real code**: Tags must be ABOVE implemented code (function, class, etc.)
2. **One tag per node**: Only one `//@ID` per node
3. **Number hierarchy**: Don't skip numbers (1, 1.1, 1.1.1 — not 1, 1.3)
4. **Short labels**: Maximum 3-4 words

## Validation

After saving, read `/tmp/mad-diagram.mermaid`:

```bash
cat /tmp/mad-diagram.mermaid
```

### If there are validation issues
```
%%% VALIDATION ISSUES (2)
%%%   - Tags(9) ≠ Diagrama(8)
%%%   - Conexões(10) ≠ Diagrama(9)
%%% END VALIDATION

graph LR
    ...diagram code...
```

**Action**: Fix the indicated tags, save, repeat.

### Common failure reasons
- **Flowchart**: Edge deduplication (duplicate tags become one edge)
- **Sequence**: Entry nodes become self-messages (count as connections)
- **Class**: Only groups are counted as nodes (not methods)

## Correct workflow

```typescript
// 1. Define type
//@::graph LR

// 2. Define groups
//@Entry
//@Auth
//@Dashboard

// 3. Add numbered nodes
//@Entry1:Handle login
//@Auth1:Authenticate

// 4. Add connections
//@->Auth1:Authenticate

// 5. Save (Ctrl+S / Cmd+S)

// 6. Validate
// cat /tmp/mad-diagram.mermaid

// 7. If errors: adjust tags → save → repeat
// If OK: next tag
```

## Troubleshooting

### Diagram doesn't update
- Check if you saved the file (Ctrl+S / Cmd+S)
- Check if first line is `//@::type`
- Check if there are `//@` tags in the file

### Tag doesn't appear in diagram
- Check if it's above code (not floating)
- Check syntax: `//@ID:Label` or `//@->Target:Label`
- Check number: `Name1` (not `Name01` or `Name_1` unless you want synthetic)

### Connection doesn't appear
- Check if target exists as node
- Check arrow: `->`, `-->`, `*--`, `<|--`, `o--`
- For classDiagram: associate with correct group

### Validation fails
- Read `%%% VALIDATION ISSUES` at top of file
- Adjust tags as indicated
- Remember: flowchart deduplicates edges

## Complete examples

See `examples/` folder:
- `01-flowchart-login.ts` — Flowchart with login, 2FA, rate limiting
- `02-sequence-api.js` — API request/response sequence
- `03-class-diagram-oop.py` — Inheritance and composition
- `04-state-machine-login.js` — State machine
- `05-er-database.sql` — Entities and relationships

## Final checklist

Before delivering, verify:

- [ ] First line is `//@::type`?
- [ ] All tags have code below (not floating)?
- [ ] Numbered nodes correct (1, 1.1, 1.1.1)?
- [ ] Labels are short and descriptive?
- [ ] Read `/tmp/mad-diagram.mermaid` and it's correct?
- [ ] No `%%% VALIDATION ISSUES` at top?
- [ ] Diagram makes logical sense?