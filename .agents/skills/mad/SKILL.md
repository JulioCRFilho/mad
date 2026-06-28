---
name: mad
description: Mermaid Auto-Doccing — generates Mermaid diagrams from //@ comments in code.
---

# MAD — Mermaid Auto-Doccing

## How it works

MAD transforms `//@` comments into Mermaid code automatically. The parser reads the file, extracts nodes and connections, and generates the final diagram.

## Fundamental rules

1. **First line**: `//@::DiagramType` defines the diagram type
2. **`//@` comments**: become nodes or connections in the diagram
3. **`//` comments without `@`**: are ignored
4. **Gutter icon**: every `//@` line receives a visual icon in the editor
5. **Documentation must stay in code**: NEVER create separate documentation files (`.md`, `.txt`, etc.) outside the source code. All documentation must be embedded as `//@` comments within the code itself.

## Supported diagram types

```typescript
//@::graph LR          // Flowchart (left → right)
//@::graph TD          // Flowchart (top → bottom)
//@::sequenceDiagram   // Sequence diagram
//@::classDiagram      // Class diagram
//@::stateDiagram-v2   // State machine
//@::erDiagram         // Entity-relationship diagram
```

## Naming system

### Simple nodes (without numbers)
```typescript
//@AuthService        // Group/class without numbering
```
- **Groups**: become `subgraph` in flowchart or classes in classDiagram
- **Participants**: become participants in sequenceDiagram

### Numbered nodes
```typescript
//@Auth1             // First step of Auth group
//@Auth1.1           // Sub-step of Auth1
//@Auth1.1.2         // Sub-sub-step
```

**Numbering rules:**
- `Name1` → entry node (first level)
- `Name1.1` → sequence of previous node
- `Name1.1.2` → third level of depth
- Nodes are automatically sorted by number

### Custom labels
```typescript
//@Auth1:Authenticate user    // Node with custom label
//@Auth1.1:Verify 2FA         // Sub-step with label
```

## Defining nodes

### Flowchart
```typescript
//@::graph LR

//@Entry                    // Root group
class LoginController {
  //@Entry1:Receive request    // Node inside group
  async login() {
    //@->Auth1:Authenticate    // Connection (see Connections section)
  }
}

//@Auth                     // Another group
class AuthService {
  //@Auth1:Validate credentials
}
```

**Generates:**
```mermaid
graph LR
    subgraph Entry
        N0["Receive request"]
    end
    subgraph Auth
        N1["Validate credentials"]
    end
    N0 -->|Authenticate| N1
```

### Sequence Diagram
```typescript
//@::sequenceDiagram

//@Client
class ApiClient {
  //@Client1:Send request
  async fetch() {
    //@->Server:GET /api/users
  }
}

//@Server
class UserService {
  //@Server1:Process data
}
```

**Generates:**
```mermaid
sequenceDiagram
    participant Client
    participant Server
    Client->>Server: GET /api/users
```

### Class Diagram
```python
#@::classDiagram

#@User
class User:
    #@User1:__init__
    def __init__(self, name):
        pass
    
    #@User1.1:get_name
    def get_name(self):
        pass

#@Customer
class Customer(User):
    #@<|--User:inherits from
    #@Customer1:__init__
```

**Generates:**
```mermaid
classDiagram
    class User {
        +__init__(name)
        +get_name()
    }
    class Customer {
        +__init__()
    }
    Customer --|> User
```

### State Diagram
```typescript
//@::stateDiagram-v2

//@LoggedOut
class LoggedOutState {
  //@LoggedOut1:Show form
  showForm() {}
}

//@LoggingIn
class LoggingInState {
  //@LoggingIn1:Authenticate
  authenticate() {
    //@->LoggedIn:Success
    //@->LoggedOut:Failure
  }
}

//@LoggedIn
class LoggedInState {
  //@LoggedIn1:Show dashboard
}

// Connections between states (outside classes)
//@LoggedOut->LoggingIn:Submit
//@LoggingIn->LoggedIn:Auth OK
//@LoggingIn->LoggedOut:Invalid credentials
```

**Generates:**
```mermaid
stateDiagram-v2
    [*] --> LoggedOut
    LoggedOut --> LoggingIn: Submit
    LoggingIn --> LoggedIn: Auth OK
    LoggingIn --> LoggedOut: Invalid credentials
    LoggedIn --> [*]
```

### ER Diagram
```sql
--@::erDiagram

--@User
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(150)
);

--@Order
CREATE TABLE orders (
  id INT PRIMARY KEY,
  user_id INT
);

-- Relationships (separate lines)
--@User->Order:has
--@Order->User:belongs to
```

**Generates:**
```mermaid
erDiagram
    User ||--o{ Order : "has"
    Order }o--|| User : "belongs to"
```

## Connections between nodes

### General syntax

```typescript
//@Source->Target:label          // Generic connection (inline)
//@->Target:label                // Connection with implicit source (retro-pointer)
```

**Practical examples:**

```typescript
//@::graph LR

//@Entry
class Controller {
  //@Entry1:Start
  start() {
    //@->Auth1:Validate token      // Source: Entry1 (current context)
    //@->Database1:Fetch data     // Another connection from same context
  }
}

//@Auth
class AuthService {
  //@Auth1:Verify JWT
}

//@Database
class DatabaseService {
  //@Database1:SQL query
}

//@Entry->Auth:Main flow         // Explicit source: Entry group
//@Auth->Database:Query data     // Explicit source: Auth group
```

### Class Diagram connections

```typescript
//@::classDiagram

//@User
class User {
  //@User1:__init__
}

//@Address
class Address {
  //@Address1:__init__
}

// UML relationships
//@User-->Address:has              // Association
//@Customer<|--User:inherits       // Inheritance
//@Order*--OrderItem:contains      // Composition
//@CartItem o--Product:references  // Aggregation
```

**Relationship types:**
- `-->` — Association (solid line)
- `<|--` — Inheritance/generalization (empty triangle)
- `*--` — Composition (filled diamond)
- `o--` — Aggregation (empty diamond)

### Sequence Diagram connections

```typescript
//@::sequenceDiagram

//@Client
class ApiClient {
  //@Client1:Request data
  async fetch() {
    //@->Server:Request user       // Standard sync arrow
    //@->>Database:SQL query       // Sync arrow (same as ->)
  }
}
```

## Conventions and patterns

### 1. One node per responsibility
```typescript
// ✅ Good
//@Auth1:Validate credentials
//@Auth1.1:Verify 2FA

// ❌ Bad
//@Auth1:Validate credentials AND verify 2FA AND create session
```

### 2. Short names, descriptive labels
```typescript
// ✅ Good
//@DB1:Fetch user by ID

// ❌ Bad
//@DatabaseServiceFindUserByIdFromDatabaseWithJoins1
```

### 3. Connect Entry/Start to next step
```typescript
//@::graph LR

//@Entry
class App {
  //@Entry1:Start application
  init() {
    //@->Config1:Load config  // Always connect to next step
  }
}
```

### 4. Limit subgraphs/states
- Maximum 7-9 nodes per diagram
- Prefer multiple small diagrams over one giant diagram
- Extract secondary details to separate diagrams

### 5. Number hierarchy
```typescript
// Correct structure:
//@Feature1          // First level
//@Feature1.1        // Second level (child of Feature1)
//@Feature1.1.1      // Third level (child of Feature1.1)

// Avoid gaps:
//@Feature1
//@Feature1.3        // ❌ Skipped 1.1 and 1.2
```

## Common patterns

### HTTP request flow
```typescript
//@::graph LR

//@Entry
class ApiController {
  //@Entry1:Receive request
  handle(req, res) {
    //@->Middleware1:Validate auth
    //@->Service1:Process
    //@->Response1:Return JSON
  }
}

//@Middleware
class AuthMiddleware {
  //@Middleware1:Verify JWT
}

//@Service
class BusinessService {
  //@Service1:Execute logic
}

//@Response
class ResponseHandler {
  //@Response1:Format output
}
```

### State cycle
```typescript
//@::stateDiagram-v2

//@Idle
class IdleState {
  //@Idle1:Waiting for event
}

//@Processing
class ProcessingState {
  //@Processing1:Working
  work() {
    //@->Idle:Completed
    //@->Error:Failed
  }
}

//@Error
class ErrorState {
  //@Error1:Log error
  handle() {
    //@->Idle:Retry
  }
}

//@Idle->Processing:Start
//@Processing->Error:Exception
//@Error->Idle:Recover
```

### Complex relationships (ER)
```sql
--@::erDiagram

--@User
CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(150));

--@Order
CREATE TABLE orders (id INT PRIMARY KEY, user_id INT);

--@Product
CREATE TABLE products (id INT PRIMARY KEY, name VARCHAR(250));

--@OrderItem
CREATE TABLE order_items (id INT PRIMARY KEY, order_id INT, product_id INT);

-- Relationships
--@User||--o{Order:places
--@Order||--|{OrderItem:contains
--@Product||--o{OrderItem:references
```

## Readability tips

### Prefer multiple small diagrams
```typescript
// ✅ Diagram 1: Authentication flow
//@::graph LR
//@Entry->Auth->Token

// ✅ Diagram 2: Data flow
//@::graph LR
//@Token->API->Database
```

### Remove peripheral nodes
```typescript
// ❌ Bad - too many details
//@Entry->Auth->DB->Cache->Logger->Metrics->Email->SMS

// ✅ Good - focus on essentials
//@Entry->Auth->DB
```

### Use labels for context
```typescript
//@Entry->Auth:with valid token
//@Auth->DB:optimized query
//@DB->Cache:check hit
```

## Parser behavior

### Processing order
1. Line 1: reads `//@::type` to define diagram
2. Scans all lines looking for `//@`
3. Separates nodes (retro-pointers) from connections (forward-pointers)
4. Sorts nodes by number: `Name1` < `Name1.1` < `Name2`
5. Generates Mermaid code

### Matching rules
```typescript
// Priority order in parser:
// 1. //@<|--Target, //@*--Target, //@o--Target, //@-->Target  (class arrows)
// 2. //@->Target:label                                        (explicit forward)
// 3. //@Source->Target:label                                  (inline forward)
// 4. //@ID:label                                              (simple node)
```

### Automatic groups
```typescript
// Nodes without numbers are groups:
//@AuthService       → Group "AuthService"
//@Auth1             → Entry of AuthService group
//@Auth1.1           → Sequence of Auth1

// The parser automatically:
// - Groups Auth1 and Auth1.1 under AuthService
// - Creates subgraph in flowchart
// - Sorts by number
```

## Complete examples

See the `examples/` folder for working examples:
- `01-flowchart-login.ts` — Authentication flow
- `02-sequence-api.js` — API sequence
- `03-class-diagram-oop.py` — Class model
- `04-state-machine-login.js` — State machine
- `05-er-database.sql` — Database model

## Quick checklist

When writing MAD tags, verify:

- [ ] First line is `//@::type`?
- [ ] Every important node has `//@`?
- [ ] Nodes are correctly numbered (1, 1.1, 1.1.2)?
- [ ] Connections use `->` or `->>`?
- [ ] Labels are short and descriptive?
- [ ] Diagram has < 10 nodes?
- [ ] Flow has clear start and end?

## Troubleshooting

### Node doesn't appear in diagram
- Check if it starts with `//@` (not just `//`)
- Make sure there are no spaces before tags

### Connection doesn't work
- Use `//@->Target` (implicit source) or `//@Source->Target` (explicit source)
- Don't mix both styles in the same line

### Node order is wrong
- Use sequential numbering: `1`, `1.1`, `1.1.1`
- Avoid gaps: `1`, `1.3` (missing 1.1 and 1.2)

### Subgraph doesn't group correctly
- Make sure the group has no numbers: `//@Auth` (not `//@Auth1`)
- Child nodes should start with group name: `//@Auth1`, `//@Auth2`