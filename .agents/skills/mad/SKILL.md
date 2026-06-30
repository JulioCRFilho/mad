---
name: mad
description: Generates Mermaid diagrams from code using //@ MAD tags, with specific syntax for each diagram type.
---

# MAD (Mermaid Auto-Doccing) Protocol

## 1. Universal Rules
*   **Trigger**: All changes must be saved (Ctrl+S) to generate the diagram.
*   **File Path**: Generated output is located at `/tmp/mad-diagram.mermaid`.
*   **Diagram Type Directive**: Add `//@::[type]` anywhere in the file (e.g., `//@::graph LR`). The parser searches all lines and uses `flowchart TD` as fallback if not found.
*   **Tag Placement**: Place MAD tags as comments **right above** the code line or block they describe, just like regular code comments. Do NOT group all tags in a single location. Distribute them throughout the file near the relevant code.
*   **Tag Format**: Use `//@` or `// @` (with space) for all MAD tags.
*   **Self-Correction**: Always `cat /tmp/mad-diagram.mermaid` after saving. If the header `%%% VALIDATION ISSUES` exists, analyze the error, fix the tags, and re-save.

---

## 2. Diagram-Specific Tagging References

### 2.1 Flowchart (`//@::graph LR` or `TD`)
*   **Placement**: Place tags directly above the code they describe (classes, methods, blocks).
*   **Groups**: Use `//@GroupName` above a class/block to create a `subgraph`.
*   **Entry Nodes**: Use `//@Group1:Label` for main nodes inside subgraphs (e.g., `//@Entry1:Handle login`).
*   **Sequence Nodes**: Use `//@Group1.1:Label` for sub-steps (e.g., `//@Entry1.1:Verify 2FA`).
*   **Synthetic Nodes**: Use `//@Node_1:Label` for standalone nodes outside groups.
*   **Connections**: Use `//@->Target:Label` (implicit source) or `//@Source->Target:Label` (explicit).
*   **Deduplication**: Duplicate connections are automatically combined into one edge.

### 2.2 Sequence Diagram (`//@::sequenceDiagram`)
*   **Placement**: Place tags directly above the code they describe (methods, function calls).
*   **Participants**: Use `//@GroupName` above a class/component to define a participant.
*   **Self-Messages**: Numbered nodes (e.g., `//@Client1:Fetch data`) become self-messages (`Client->>Client: Fetch data`).
*   **Arrows**: All messages use `->>` (double arrow).
*   **Ordering**: Connection flow follows the strict top-to-bottom order of the file.

### 2.3 Class Diagram (`//@::classDiagram`)
*   **Placement**: Place tags directly above the code they describe (class definitions, methods).
*   **Classes**: Use `//@GroupName` above a class definition.
*   **Methods**: Use `//@Group1:Label` for internal class methods (rendered as `+<Label>()` where Label is the text after the colon).
*   **Relationships**: 
    *   Association: `//@Source-->Target:Label` or `//@--Target:Label` (inside class)
    *   Inheritance: `//@<|--Target:Label` (means "current class inherits from Target")
    *   Composition: `//@Source*--Target:Label`
    *   Aggregation: `//@Sourceo--Target:Label` or `//@Source o--Target:Label`

### 2.4 State Diagram (`//@::stateDiagram-v2`)
*   **Placement**: Place tags directly above the code they describe (state classes, methods).
*   **States**: Use `//@GroupName` above the class representing the state.
*   **Actions**: Use `//@Group1:Label` for actions within a state (rendered as `ActionId: Label` where ActionId has all spaces removed from the label text).
*   **Transitions**: Use `//@Source->Target:Label` to define state changes (rendered as `Source --> Target: Label`).

### 2.5 ER Diagram (`//@::erDiagram`)
*   **Placement**: Place tags directly above the SQL table definition they describe.
*   **Entities**: Use `//@GroupName` above the SQL table definition.
*   **Attributes**: The SQL `CREATE TABLE` code block below the tag is parsed to extract column names as entity attributes.
*   **Relationships**: Use `//@Source->Target:Label` to define relationships.
    *   Default cardinality: `||--o{` (one-to-many)
    *   One-to-one: Use labels matching `has.one`, `billing`, or `shipping` (the dot matches any character, so `has-one`, `has_one`, `has:one` also work) → `||--||`
    *   Inversion: Label `"references"` inverts direction (child->parent becomes parent->child).

---

## 3. Agent Execution Checklist
1.  **Identify**: Choose the diagram type that best fits the code's logic.
2.  **Declare**: Place `//@::[type]` anywhere in the file.
3.  **Implement**: Apply the specific syntax rules for that type (as defined in section 2).
4.  **Validate**: Save the file, run `cat /tmp/mad-diagram.mermaid`, and resolve any `%%% VALIDATION ISSUES` immediately.