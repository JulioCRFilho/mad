# Implementation Plan — HTTP Server for CLI Agent Validation

## [Overview]
Add a local HTTP server to the MAD VS Code extension that accepts file paths via REST and returns the same diagram validation/generation results that currently only fire on VSCode save events. Works out-of-the-box on Windows, macOS, and Linux with zero permissions or configuration required.

The current validation pipeline (`createSaveHandler` → `generateDiagram` → `BaseDiagramCommand.generateOnly` → `saveToOutputFile`) is tightly coupled to VSCode's `onDidSaveTextDocument` event. CLI agents (AI tools, scripts) modifying files via command line never trigger this event, so `/tmp/mad-diagram.mermaid` is never regenerated. An HTTP endpoint bypasses this, allowing `curl -X POST http://127.0.0.1:PORT/validate -H "Content-Type: application/json" -d '{"filePath":"/path/to/file.ts"}'` to invoke the full pipeline and return structured JSON results.

**Cross-platform guarantees:** The server binds to `127.0.0.1` only (loopback), so no firewall prompts. It uses port `0` by default (OS auto-assigns a free port), so zero configuration needed. Users may optionally set `mad.server.port` for a fixed port.

## [Types]
New request/response types for the HTTP API, defined in `src/core/server/types.ts`.

```typescript
/** Request body for POST /validate */
export interface ValidateRequest {
    /** Absolute path to the source file containing MAD tags */
    filePath: string;
}

/** Successful validation response */
export interface ValidateResponseSuccess {
    status: 'ok';
    /** Path to the generated /tmp/mad-diagram.mermaid file */
    outputFile: string;
    /** The generated Mermaid code */
    mermaidCode: string;
    /** The diagram type detected (e.g. "graph TD", "sequenceDiagram") */
    diagramType: string;
    /** Validation warnings (tag count mismatches, orphan tags, etc.) */
    warnings: string[];
    /** Processing time in milliseconds */
    durationMs: number;
}

/** Error response */
export interface ValidateResponseError {
    status: 'error';
    /** Error classification */
    errorType: 'file_not_found' | 'no_mad_tags' | 'no_diagram_tag' | 'mad_validation_failed' | 'mermaid_validation_failed' | 'internal_error';
    message: string;
    /** Optional detailed validation errors */
    details?: string[];
}

export type ValidateResponse = ValidateResponseSuccess | ValidateResponseError;
```

Extension configuration additions for `package.json`:

```json
"mad.server.enabled": {
    "type": "boolean",
    "default": true,
    "description": "Enable the local HTTP server for CLI agent validation"
},
"mad.server.port": {
    "type": "number",
    "default": 0,
    "description": "HTTP server port (0 = auto-assign). Restart required."
}
```

## [Files]

### New files

| File | Purpose |
|------|---------|
| `src/core/server/types.ts` | Request/response TypeScript interfaces |
| `src/core/server/handler.ts` | Core validation logic decoupled from VSCode APIs — accepts a file path string, reads the file, runs the full pipeline, returns `ValidateResponse` |
| `src/core/server/server.ts` | HTTP server lifecycle using Node.js `http` module — start, stop, request routing, JSON parsing/response |
| `src/core/server/index.ts` | Barrel export |

### Modified files

| File | Changes |
|------|---------|
| `src/core/diagram/parser.ts` | Extract `filterAllNodesFromText(text: string): NodeInfo[]` from `filterAllNodes(document)`. The original delegates to the text version. |
| `src/core/commands/shared/helpers.ts` | Create text/lines-based versions of `extractCodeLine`, `extractSQLBlock`, `processRetroPointers`, `processForwardPointers`, `findRelatedTags`, `findRelatedTagsWithOrder`. Originals delegate to the text versions. |
| `extension.ts` | In `activate()`: call `startServer(context)` after all setup. Register `mad.showServerStatus` command. In `deactivate()`: call `stopServer()`. |
| `package.json` | Add `mad.server.enabled` and `mad.server.port` configuration properties. Add `mad.showServerStatus` command. |

## [Functions]

### New functions in `src/core/server/server.ts`

| Function | Signature | Purpose |
|----------|-----------|---------|
| `startServer` | `(context: vscode.ExtensionContext): Promise<number>` | Creates `http.createServer`, binds to configured port (`127.0.0.1` only), returns assigned port. Stores server reference on `context.subscriptions` for cleanup. Logs the listening address. |
| `stopServer` | `(): void` | Closes the HTTP server gracefully by calling `server.close()`. |
| `getServerPort` | `(): number \| null` | Returns the current port or `null` if not running. |
| `handleRequest` | `(req: http.IncomingMessage, res: http.ServerResponse): Promise<void>` | Routes `GET /health` (liveness check returning `{"status":"ok","version":"1.6.6"}`) and `POST /validate` (full pipeline). Returns 404 with JSON body for any other route. Wraps handler in try/catch to always return JSON. |

### New functions in `src/core/server/handler.ts`

| Function | Signature | Purpose |
|----------|-----------|---------|
| `validateFile` | `(filePath: string): Promise<ValidateResponse>` | Core function. Steps: (1) resolve and stat the file path → `file_not_found` if missing; (2) read content via `fs.readFileSync`; (3) check for `//@` or `// @` → `no_mad_tags` if absent; (4) find `//@::DiagramType` on any line → `no_diagram_tag` if absent; (5) parse tags via `parseAllTags(text, lines)`; (6) run `validateDiagram(allNodes, prefix)` → `mad_validation_failed` if errors; (7) run full generator pipeline via text-based `findRelatedTagsFromText` → `generateMermaidDiagram`; (8) validate Mermaid syntax via `validateMermaidSyntax` → `mermaid_validation_failed` if error; (9) run `validateDiagramCounts` for warnings; (10) write output to `/tmp/mad-diagram.mermaid` via `saveToOutputFile`; (11) return `ValidateResponseSuccess` with code, warnings, timing. |

### Refactored functions (text-based variants)

All in `src/core/diagram/parser.ts`:

| Function | Purpose |
|----------|---------|
| `filterAllNodesFromText(text: string): NodeInfo[]` | Core logic extracted from `filterAllNodes`. Works on raw string instead of `vscode.TextDocument`. The existing `filterAllNodes(document)` becomes a one-liner delegate. |

All in `src/core/commands/shared/helpers.ts`:

| Function | Purpose |
|----------|---------|
| `extractCodeLineFromLines(lines: string[], tagLine: number): string \| null` | Text-based variant of `extractCodeLine`. |
| `extractSQLBlockFromLines(lines: string[], tagLine: number): string \| null` | Text-based variant of `extractSQLBlock`. |
| `processRetroPointersFromLines(...)` | Accepts `lines: string[]` instead of `vscode.TextDocument`. |
| `processForwardPointersFromLines(...)` | Accepts `lines: string[]` instead of `vscode.TextDocument`. |
| `findRelatedTagsFromText(text: string, prefix: string, diagramType: string): ProcessedNode[]` | Full pipeline from raw text — calls `filterAllNodesFromText` → `splitNodes` → text-based retro/forward processors → `filterAndSortNodes`. |

## [Classes]
No new classes. The server module is implemented as pure functions, consistent with the codebase's existing functional style. The `BaseDiagramCommand` class hierarchy and all generators are unchanged.

## [Dependencies]
Zero external dependencies. Uses only:
- Node.js built-in `http` module (HTTP server)
- Node.js built-in `fs` module (file reading)
- Node.js built-in `path` module (path resolution)
- Existing `mermaid` dependency (syntax validation, already bundled)

No changes to `package.json` dependencies. Configuration properties only under `contributes.configuration`.

## [Testing]

**Existing test suite:** `npm test` runs `test/mad-outputs.test.mjs` (29 tests). These must continue to pass after refactoring — the text-based function variants must produce identical output.

**New verification steps (not automated tests, but manual smoke checks):**

1. **Health check:**
   ```
   curl -s http://127.0.0.1:PORT/health | jq .
   # Expected: {"status":"ok","version":"1.6.6"}
   ```

2. **Validate a MAD source file:**
   ```
   curl -s -X POST http://127.0.0.1:PORT/validate \
     -H "Content-Type: application/json" \
     -d "{\"filePath\":\"$(pwd)/extension.ts\"}" | jq .
   # Expected: {"status":"ok","outputFile":"/tmp/mad-diagram.mermaid",...}
   ```

3. **Missing file:**
   ```
   curl -s -X POST http://127.0.0.1:PORT/validate \
     -H "Content-Type: application/json" \
     -d '{"filePath":"/nonexistent/file.ts"}' | jq .
   # Expected: {"status":"error","errorType":"file_not_found",...}
   ```

4. **File without MAD tags:**
   ```
   curl -s -X POST http://127.0.0.1:PORT/validate \
     -H "Content-Type: application/json" \
     -d "{\"filePath\":\"$(pwd)/tsconfig.json\"}" | jq .
   # Expected: {"status":"error","errorType":"no_mad_tags",...}
   ```

## [Implementation Order]

1. **Step 1:** Create `src/core/server/types.ts` — request/response TypeScript interfaces
2. **Step 2:** Refactor `filterAllNodes` in `src/core/diagram/parser.ts` — extract `filterAllNodesFromText`, make original delegate
3. **Step 3:** Refactor `extractCodeLine` / `extractSQLBlock` in `src/core/commands/shared/helpers.ts` — create lines-based variants
4. **Step 4:** Refactor `processRetroPointers` / `processForwardPointers` in `helpers.ts` — create lines-based variants
5. **Step 5:** Refactor `findRelatedTags` / `findRelatedTagsWithOrder` in `helpers.ts` — create `findRelatedTagsFromText`
6. **Step 6:** Create `src/core/server/handler.ts` — `validateFile` function using all text-based pipeline functions
7. **Step 7:** Create `src/core/server/server.ts` — HTTP server with `startServer`, `stopServer`, `handleRequest`
8. **Step 8:** Create `src/core/server/index.ts` — barrel export
9. **Step 9:** Update `package.json` — add `mad.server.enabled`, `mad.server.port` configuration, `mad.showServerStatus` command
10. **Step 10:** Update `extension.ts` — import server, start in `activate()`, stop in `deactivate()`, register status command
11. **Step 11:** Compile (`npm run compile`) and fix any TypeScript errors
12. **Step 12:** Run existing test suite (`npm test`) to verify zero regressions (29/29 pass)
13. **Step 13:** Manual smoke test with curl — health endpoint, validate extension.ts, missing file, file without tags