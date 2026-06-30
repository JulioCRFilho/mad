# MAD - Mermaid Auto-Doccing Skill

Generate Mermaid diagrams from code using `//@` tags embedded in code comments.

## Overview

MAD (Mermaid Auto-Doccing) is a VS Code extension that automatically generates Mermaid diagrams from specially formatted comments in your code. By placing `//@` tags directly above code elements, you can create visual documentation that stays in sync with your codebase.

## Quick Start

1. **Add a diagram type directive** anywhere in your file:
   ```typescript
   //@::graph LR
   ```

2. **Place tags directly above code** you want to document:
   ```typescript
   //@Auth
   class AuthService {
     //@Auth1:Login
     async login() {}
     
     //@Auth2:Logout
     async logout() {}
   }
   ```

3. **Save the file** (Ctrl+S) - the diagram is generated automatically

4. **View the output** at `/tmp/mad-diagram.mermaid`

## Supported Diagram Types

| Type | Directive | Use Case |
|------|-----------|----------|
| Flowchart | `//@::graph LR` or `//@::graph TD` | Process flows, control flow, algorithms |
| Sequence | `//@::sequenceDiagram` | API calls, message flows, interactions |
| Class Diagram | `//@::classDiagram` | OOP relationships, domain models |
| State Machine | `//@::stateDiagram-v2` | State transitions, workflows |
| ER Diagram | `//@::erDiagram` | Database schemas, entity relationships |

## Core Principles

### ⚠️ Tag Placement is Critical

**ALWAYS place tags directly above the code they describe.** Never group all tags in a header section.

❌ **Wrong:**
```typescript
//@::graph LR
//@Auth1:Login
//@Auth2:Logout
class AuthService {
  async login() {}
  async logout() {}
}
```

✅ **Correct:**
```typescript
//@::graph LR
//@Auth
class AuthService {
  //@Auth1:Login
  async login() {}
  
  //@Auth2:Logout
  async logout() {}
}
```

### ⚠️ 100% Flow Coverage Required

Document **EVERY** code path, not just some parts:
- All public and private methods/functions
- All conditional branches (if/else, switch/case)
- All error handling paths and exceptions
- All loops and iterations
- All API endpoints and their flows
- All database queries and data transformations
- All external service calls
- All state transitions

Incomplete documentation defeats the purpose of MAD diagrams.

## Basic Syntax

### Groups (Subgraphs/Participants/Classes/States/Entities)

```typescript
//@GroupName
class MyClass {
  // ...
}
```

### Entry Nodes (Main Steps)

```typescript
//@Group1:Label
async methodName() {
  // ...
}
```

### Sequence Nodes (Sub-Steps)

```typescript
//@Group1.1:Sub-step label
async subMethod() {
  // ...
}
```

### Connections

```typescript
// Implicit source (current group/method)
//@->Target:Label

// Explicit source
//@Source->Target:Label
```

## Examples

This skill includes 5 comprehensive examples demonstrating all diagram types:

1. **[01-flowchart-login.ts](examples/01-flowchart-login.ts)** - Login flow with authentication, 2FA, rate limiting, and error handling
2. **[02-sequence-api.js](examples/02-sequence-api.js)** - API request flow with authentication middleware, caching, and database queries
3. **[03-class-diagram-oop.py](examples/03-class-diagram-oop.py)** - OOP domain model with inheritance, composition, and associations
4. **[04-state-machine-login.js](examples/04-state-machine-login.js)** - Login state machine with all states and transitions
5. **[05-er-database.sql](examples/05-er-database.sql)** - E-commerce database schema with entities and relationships

See [config.yaml](config.yaml) for detailed metadata about each example.

## Workflow

1. **Identify** the diagram type that best fits your code's logic
2. **Declare** the diagram type with `//@::[type]`
3. **Implement** tags following the syntax rules for your diagram type
4. **Validate** by saving and checking `/tmp/mad-diagram.mermaid`
5. **Fix** any `%%% VALIDATION ISSUES` reported in the output

## Validation

After saving, the extension validates your diagram and reports issues:

```
%%% VALIDATION ISSUES (2)
%%%   - //@->Unknown points to "Unknown" which has not been declared
%%%   - "Login1.1" has parent "Login1.1" which has not been declared
%%% END VALIDATION
```

Fix the reported issues and re-save until validation passes.

## Common Mistakes

### ❌ DON'T: Group tags in a header
```typescript
//@::graph LR
//@Group1
//@Group1:Node1
//@Group2:Node2
class MyClass {}
```

### ❌ DON'T: Document only some methods
```typescript
class AuthService {
  //@Auth1:Login
  async login() {}
  
  async logout() {} // Missing tag!
}
```

### ❌ DON'T: Skip error paths
```typescript
async process() {
  if (valid) {
    return success();
  }
  // Missing error path documentation
}
```

### ✅ DO: Document everything
```typescript
//@::graph LR
//@Auth
class AuthService {
  //@Auth1:Login
  async login() {}
  
  //@Auth2:Logout
  async logout() {}
  
  //@Auth3:Process
  async process() {
    //@->Validation:Validate input
    if (!valid) {
      //@->Error:Invalid input
      throw new Error('Invalid');
    }
    //@->Success:Process
    return success();
  }
}
```

## Advanced Features

### Flowchart
- **Subgraphs**: Group related nodes with `//@GroupName`
- **Hierarchy**: Use numbered nodes (`Entry1`, `Entry1.1`) for nested steps
- **Synthetic nodes**: Auto-generated nodes for connections without explicit definitions
- **Deduplication**: Duplicate connections are automatically merged

### Sequence Diagram
- **Self-messages**: Numbered nodes create self-references (`Client1` → `Client->>Client`)
- **Ordering**: Messages follow strict top-to-bottom file order
- **Participants**: Auto-discovered from groups and connections

### Class Diagram
- **Methods**: Rendered as `+MethodName()` with visibility indicator
- **Relationships**:
  - Association: `-->` or `--`
  - Inheritance: `<|--`
  - Composition: `*--`
  - Aggregation: `o--`

### State Diagram
- **Actions**: Methods within state classes become state actions
- **Transitions**: Direct connections between states
- **Nested states**: Use numbered actions for state internals

### ER Diagram
- **Auto-attributes**: Parses `CREATE TABLE` blocks to extract columns
- **Cardinality**: Infers from labels (`has one` → one-to-one, default → one-to-many)
- **Direction**: `references` label inverts relationship direction

## Configuration

See [config.yaml](config.yaml) for:
- Output file location
- Supported diagram types
- Tag format variations
- Coverage requirements

## Tips

1. **Start with groups** - Define your main components/classes/states first
2. **Add entry nodes** - Document the main methods in each group
3. **Add sequence nodes** - Break down complex methods into sub-steps
4. **Connect the dots** - Add relationship tags to show flow
5. **Validate often** - Check `/tmp/mad-diagram.mermaid` after each save
6. **Be complete** - Document every path, every error, every branch

## Troubleshooting

**Problem**: Tags not appearing in diagram
- **Solution**: Ensure tags are directly above code, not in a header section

**Problem**: "Not declared" validation errors
- **Solution**: Define all target nodes with `//@TargetName` before referencing them

**Problem**: Missing connections
- **Solution**: Place connection tags directly above the source group/class

**Problem**: Wrong diagram type
- **Solution**: Check that `//@::[type]` matches one of the supported types

## Resources

- [Mermaid Documentation](https://mermaid.js.org/)
- [VS Code Extension](https://github.com/JulioCRFilho/mad)
- [Examples](examples/)

## License

MIT