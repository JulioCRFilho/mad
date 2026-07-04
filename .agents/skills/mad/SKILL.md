---
name: mad
description: Generates Mermaid diagrams from code using //@ MAD tags, with specific syntax for each diagram type.
---

# MAD (Mermaid Auto-Doccing) Protocol

## 1. Universal Rules
*   **Trigger**: All changes must be saved (Ctrl+S) to generate the diagram.
*   **File Path**: Generated output is located at `/tmp/mad-diagram.mermaid`.
*   **Diagram Type Directive**: Add `//@::[type]` anywhere in the file (e.g., `//@::graph LR`). The parser searches all lines and uses `flowchart TD` as fallback if not found.
*   **Tag Placement**: ⚠️ **CRITICAL** - Place MAD tags as comments **right above** the code line or block they describe. **NEVER group all tags in a header section at the top of the file.** Distribute them throughout the file near the relevant code. Each tag must be directly above its target code.
*   **100% Flow Coverage**: ⚠️ **CRITICAL** - Document **EVERY** code path, not just some parts. This includes:
    *   All public and private methods/functions
    *   All conditional branches (if/else, switch/case)
    *   All error handling paths and exceptions
    *   All loops and iterations
    *   All API endpoints and their flows
    *   All database queries and data transformations
    *   All external service calls
    *   All state transitions
    *   Incomplete documentation defeats the purpose of MAD diagrams
    *   ⚠️ **Exception**: Pure data structs, trivial UI builders, and one-line utility methods do NOT need every field/micro-step tagged. Apply 100% coverage to the **meaningful code paths** (branches, error handling, external calls). A flat list of independent static methods with no flow between them may not benefit from a diagram at all — consider skipping MAD tags entirely for such files.
*   **Tag Format**: Use `//@` or `// @` (with space) for all MAD tags.
*   **Self-Correction**: Always `cat /tmp/mad-diagram.mermaid` after saving. If the header `%%% VALIDATION ISSUES` exists, analyze the error, fix the tags, and re-save.
*   **Parser Behavior — Group Name Digit Splitting**: ⚠️ **CRITICAL** - The parser splits group names at the first digit using regex `^([a-zA-Z_]+)\d+$` (in `src/core/commands/shared/helpers.ts`). The character class `[a-zA-Z_]+` greedily consumes underscores. This means:
    *   `BuildV5` → group `BuildV` + node `5` (❌ group `BuildV` was never declared)
    *   `Step0` → group `Step` + node `0` (❌ group `Step` was never declared)
    *   `CurrentPaymentProvider_1` → group `CurrentPaymentProvider_` + node `1` (❌ trailing underscore)
    *   `PagarMe_1` → group `PagarMe_` + node `1` (❌ trailing underscore)
    *   **Workaround**: Choose names where the text before the final digit forms a valid declared group. Use `//@Steps` + `//@Steps0` (not `//@Step` + `//@Step0`). Avoid trailing underscores before digits. For external systems in sequence diagrams, use bare names (e.g., `//@Pagarme`) — they work as connection targets even without `_1` suffix.
*   **Validation False Positives**: The `Connections(N) ≠ Diagram(M)` warning is a **known false positive** caused by deduplication when identical `(source, target, label)` triples appear in multiple places (e.g., two different methods use the same self-message label). If the diagram shows all expected participants and flows, ignore this warning.

---

## 2. Diagram-Specific Tagging References

### 2.1 Flowchart (`//@::graph LR` or `TD`)
*   **Placement**: Place tags directly above the code they describe (classes, methods, blocks).
*   **Groups**: Use `//@GroupName` directly above a class/block to create a `subgraph`.
*   **Entry Nodes**: Use `//@Group1:Label` directly above methods for main nodes inside subgraphs (e.g., `//@Entry1:Handle login` above the method).
*   **Sequence Nodes**: Use `//@Group1.1:Label` directly above sub-methods for sub-steps (e.g., `//@Entry1.1:Verify 2FA`).
*   **Synthetic Nodes**: Use `//@NodeName_1:Label` for standalone nodes outside groups. The `_1` suffix is required to distinguish synthetic nodes from groups. These are the **only** way to represent external systems (APIs, databases, services) that are not code classes.
    *   ⚠️ **Parser limitation**: Names like `Pagarme_1` or `Database_1` may be parsed as group `Pagarme_` / `Database_` due to trailing underscore capture. If you encounter `"X_1" belongs to group "X_"` errors, use bare `//@Pagarme` and `//@Pagarme->>Pagarme:...` in sequence diagrams instead, which works correctly.
*   **Group vs Node Distinction**:
    *   `//@GroupName` → creates a `subgraph` (container for nodes)
    *   `//@GroupName:Label` → creates an entry **node** inside the group
    *   `//@NodeName_1:Label` → creates a standalone **synthetic node** outside any group
    *   ⚠️ Only nodes (entry nodes and synthetic nodes) can be used as connection targets. Groups cannot.
*   **Connections**: Place connection tags directly above the group/class definition or directly above the specific code line that performs the action:
    *   Use `//@->Target:Label` (implicit source)
    *   Use `//@Source->Target:Label` (explicit)
    *   Use `->` for standard connections (not `->>` which is reserved for sequence diagrams)
*   **Deduplication**: Duplicate connections are automatically combined into one edge.

### 2.2 Sequence Diagram (`//@::sequenceDiagram`)
*   **Placement**: Place tags directly above the code they describe (methods, function calls).
*   **Participants**: Use `//@GroupName` directly above a class/component to define a participant. External systems (e.g., `S3`, `Email`) used as connection targets are **automatically added** as participants — no explicit `//@` tag is needed for them.
*   **Function Groups**: Numbered nodes (e.g., `//@Client1:Fetch data`) define a function group rendered inside a `rect` block with a `Note over` header. Step numbering restarts from 1 within each group. Self-messages are **not** automatically generated — only explicit connection tags produce messages.
*   **Arrows**: All messages use `->>` (double arrow). ⚠️ **Never** use `->` in sequence diagrams — it's flowchart syntax and will cause `"Target has not been declared"` errors.
*   **Connection Tags**: Use `//@Source->>Target:Label` for messages between participants. Use `//@->>Target:Label` when the source is the current method/participant.
*   **Step Numbering in Arrow**: Use `//@Source->N>Target:Label` to embed a custom step number inside the arrow, where `N` is the step number (e.g., `1`, `1.1`, `1.2`, `2`, etc.). The step number replaces the auto-generated hierarchical numbering for that message. Example: `//@Provider->1>Provider:Validate input` produces `Provider->>Provider: 1 Validate input`. This is useful when you need to group steps under specific sub-numbers (e.g., `1`, `1.1`, `1.2`) while maintaining the overall flow.
*   **Implicit Grouping**: Each message is grouped under whichever numbered method (e.g., `Provider1`) its connection tag appears **inside**, based on the tag's position in the file. A connection using the group name as source (e.g., `//@Storage->1>S3:Upload`) will correctly belong to the `Storage` method — not leaked into the previous method.
*   **Ordering**: Connection flow follows the strict top-to-bottom order of the file.

### 2.3 Class Diagram (`//@::classDiagram`)
*   **Placement**: Place tags directly above the code they describe (class definitions, methods).
*   **Classes**: Use `//@GroupName` directly above a class definition.
*   **Methods**: Use `//@Group1:Label` directly above methods for internal class methods (rendered as `+<Label>()` where Label is the text after the colon).
*   ⚠️ **Every class must have at least one `//@GroupN:Label` entry node.** Classes with only `//@GroupName` (no numbered methods/fields) will produce Mermaid `Empty class definition` errors.
*   **Relationships**: 
    *   Association: `//@Source-->Target:Label` or `//@--Target:Label` (inside class)
    *   Inheritance: `//@<|--Target:Label` (means "current class inherits from Target")
    *   Composition: `//@Source*--Target:Label`
    *   Aggregation: `//@Sourceo--Target:Label` or `//@Source o--Target:Label`
    *   ⚠️ **Relationship targets must be declared in the same file.** Cross-file relationships (e.g., connecting `PaymentGatewayImpl-->repositories.OrderRepository`) will produce Mermaid errors since the target class isn't defined in that diagram.

### 2.4 State Diagram (`//@::stateDiagram-v2`)
*   **Placement**: Place tags directly above the code they describe (state classes, methods).
*   **States**: Use `//@GroupName` directly above the class representing the state.
*   **Actions**: Use `//@Group1:Label` directly above methods for actions within a state (rendered as `ActionId: Label` where ActionId has all spaces removed from the label text).
*   ⚠️ **Action labels must use simple identifiers** (single words or camelCase like `PersonalInfo` or `validateData`). Labels with spaces, dashes, or special characters (e.g., `Etapa 0 — Dados pessoais`) will produce malformed Mermaid syntax (`tGe[a.shape] is not a function`). Keep labels short and alphanumeric.
*   **Transitions**: Use `//@Source->Target:Label` directly above the code to define state changes (rendered as `Source --> Target: Label`).

### 2.5 ER Diagram (`//@::erDiagram`)
*   **Placement**: Place tags directly above the SQL table definition they describe.
*   **Entities**: Use `//@GroupName` directly above the SQL table definition.
*   **Attributes**: The SQL `CREATE TABLE` code block below the tag is parsed to extract column names as entity attributes.
*   **Relationships**: Use `//@Source->Target:Label` directly above the table definition to define relationships.
    *   Default cardinality: `||--o{` (one-to-many)
    *   One-to-one: Use labels matching `has.one`, `billing`, or `shipping` (the dot matches any character, so `has-one`, `has_one`, `has:one` also work) → `||--||`
    *   Inversion: Label `"references"` inverts direction (child->parent becomes parent->child).

---

## 3. Common Mistakes to Avoid

### ❌ DON'T: Group all tags in a header section
```dart
//@::graph LR
//@Group1
//@Group1:Node1
//@Group2:Node2
//@Group1->Group2:Connection
class MyClass {
  // ... code ...
}
```

### ✅ DO: Distribute tags throughout the file
```dart
//@::graph LR
//@Group1
class MyClass {
  //@Group1:Node1
  void method1() {
    // ... code ...
  }
  
  //@Group2:Node2
  void method2() {
    // ... code ...
  }
}
```

### ❌ DON'T: Define nodes twice (in header and inline)
```dart
//@::graph LR
//@Group1:Node1  // ❌ This creates a "loose tag" error
class MyClass {
  //@Group1:Node1  // ❌ Duplicate!
  void method1() {}
}
```

### ✅ DO: Define nodes only once, inline
```dart
//@::graph LR
//@Group1
class MyClass {
  //@Group1:Node1  // ✓ Defined once, directly above method
  void method1() {}
}
```

### ❌ DON'T: Create "loose tags" (tags not above any code)
```dart
//@::graph LR
//@Group1:Node1  // ❌ "Loose tag" - not above any code
class MyClass {}
```

### ✅ DO: Place tags directly above code
```dart
//@::graph LR
//@Group1
class MyClass {
  //@Group1:Node1  // ✓ Above code
  void method1() {}
}
```

### ❌ DON'T: Connect to a group name instead of a node
```dart
//@::graph LR
//@Batch
//@Pagarme  // ❌ This is a GROUP, not a node
//@Batch->Pagarme:POST /api  // ❌ ERROR: Pagarme is a group, not connectable
```

### ✅ DO: Use synthetic node syntax for external systems
```dart
//@::graph LR
//@Batch
//@Pagarme_1:Pagar.me V5 API  // ✓ Synthetic node
//@Batch->Pagarme_1:POST /api  // ✓ Works!
```

### ❌ DON'T: Document only some methods (partial coverage)
```dart
//@::graph LR
//@Auth
class AuthService {
  //@Auth1:Login  // ✓ Documented
  async login() {}
  
  async logout() {}  // ❌ Missing tag!
  
  //@Auth2:Register  // ✓ Documented
  async register() {}
}
```

### ✅ DO: Document ALL methods (100% coverage)
```dart
//@::graph LR
//@Auth
class AuthService {
  //@Auth1:Login
  async login() {}
  
  //@Auth2:Logout  // ✓ Every method documented
  async logout() {}
  
  //@Auth3:Register
  async register() {}
}
```

### ❌ DON'T: Skip error paths and edge cases
```dart
//@::graph LR
//@Payment
class PaymentService {
  //@Payment1:Process payment
  async processPayment() {
    if (valid) {
      return await this.charge();
    }
    // ❌ Missing: error path not documented
  }
}
```

### ✅ DO: Document all branches and error paths
```dart
//@::graph LR
//@Payment
class PaymentService {
  //@Payment1:Process payment
  async processPayment() {
    //@->Validation:Validate card
    if (!valid) {
      //@->Error:Invalid card
      throw new Error('Invalid card');
    }
    //@->Charge:Process charge
    return await this.charge();
  }
}
```

### ❌ DON'T: Stack connection tags on entry node lines (1 tag per code line)
```dart
//@Group1:Build payload    // ✓ Entry node
//@Group1->Group2:Call API // ❌ Stacked on previous entry node — no code between tags
```
```dart
//@::graph TD
//@Build
class MyClass {
  //@Build1:Do thing
  //@Build1->Steps:Call   // ❌ Two tags stacked above the same `return` statement
  @override
  Widget build() {
    return ...
  }
}
```

### ✅ DO: Move connection tags to call sites (1:1 tag-to-code ratio)
```dart
//@Group1:Build payload   // ✓ Entry node above method
void build() {
  //@Group1->Group2:Call API  // ✓ Connection tag above the actual call
  callAPI();
}
```
```dart
//@::graph TD
//@Build
class MyClass {
  //@Build
  //@Build1:Do thing
  @override
  Widget build() {
    // ... code ...
    //@Build1->Steps:Call  // ✓ Connection tag above the actual method call
    _buildStepContent(...);
  }
}
```

---

## 4. Agent Execution Checklist
1.  **Identify**: Choose the diagram type that best fits the code's logic.
    *   `sequenceDiagram` — for request/response flows, method call chains, external API calls
    *   `graph LR/TD` — for pipelines, step-by-step processes, method call trees
    *   `classDiagram` — for struct relationships, inheritance, composition
    *   `stateDiagram-v2` — for validation state machines, lifecycle states
    *   `erDiagram` — for SQL schema documentation
    *   **Consider skipping MAD tags entirely** for files with only independent static utilities, pure data structs, or boilerplate UI code with no interesting flow.
2.  **Declare**: Place `//@::[type]` anywhere in the file.
3.  **Implement**: Apply the specific syntax rules for that type (as defined in section 2).
    *   ⚠️ **CRITICAL**: Place ALL tags directly above the code they describe
    *   ⚠️ **CRITICAL**: Do NOT group tags in a header section
    *   ⚠️ **CRITICAL**: Each tag must be directly above its own code line (1:1 ratio) — never stack two tags above the same line
    *   ⚠️ **CRITICAL**: Document all meaningful code paths — every method, every branch, every error handler
    *   ⚠️ **CRITICAL**: Use bare participant names (`//@Pagarme`, `//@Database`) for external systems in sequence diagrams. Synthetic node syntax (`//@Name_1:Label`) works for flowcharts but may cause parsing issues in sequence diagrams.
4.  **Validate**: Save the file, run `cat /tmp/mad-diagram.mermaid`, and resolve any `%%% VALIDATION ISSUES` immediately.
    *   If the only validation issue is `Connections(N) ≠ Diagram(M)`: this is a **known false positive** from deduplication. Check that the diagram shows all expected participants and flows — if yes, ignore the warning.
    *   If you see `"X_N" belongs to group "X_"`: the parser split the name at a digit and captured a trailing underscore. Rename to avoid the digit-after-letter pattern (e.g., `Steps0` works if `//@Steps` is declared).
    *   If you see `Empty class definition`: add at least one `//@GroupN:Label` entry node inside the class.
    *   If you see `tGe[a.shape] is not a function`: a state diagram action label has special characters. Keep labels to simple alphanumeric identifiers.
5.  **Verify**: Ensure all nodes have connections where appropriate, no empty subgraphs exist, and the diagram tells a complete story with no gaps.