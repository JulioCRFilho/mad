# Plano de Implementação/Correção

## Baseado na comparação entre o código atual e o `plan.md`

---

## Legenda

| Símbolo | Significado |
|---|---|
| ✅ | Implementado e consistente |
| ⚠️ | Parcialmente implementado ou com bugs |
| ❌ | Não implementado |
| 🔧 | Precisa de refatoração |

---

## 1. `extension.ts` — Entrypoint

| Item | Status |
|---|---|
| Detectar clique em linha `//@` e executar comando | ✅ |
| Passar prefixo para diagram-command | ✅ |
| Atualizar decorações ao mudar documento | ✅ |

---

## 2. `parser.ts` — Filtragem e Separação

| Etapa do Plan | Status |
|---|---|
| `FilterGroups` (IDs sem números) | ✅ |
| `FilterNodes` (todas as tags `//@`) | ✅ |
| `SplitTypes` (retro vs target) | ✅ |
| `FilterPrefix` (prefixo de ID) | ✅ |
| `FilterEntryNodes` (`prefix+X`) | ✅ |
| `FilterSequences` (`prefix+X.X...`) | ✅ |
| Detectar `//@::DiagramType` | ✅ |
| Extrair código abaixo da tag | ✅ |
| Ignorar linhas de tags consecutivas | ✅ |

---

## 3. `identifier.ts` — Extração e Formatação de Label

| Regra do Plan | Status |
|---|---|
| Remover prefixos: `void`, `class`, `fun`, `def`, `function`, `const`, `val`, `var`, `let` | ✅ |
| Remover sufixos: `();`, `()`, `{}`, `;` | ✅ |
| Remover underscores `_` no início | ✅ |
| Separar camelCase/PascalCase | ✅ |
| Capitalizar primeira letra de cada palavra | ✅ |

---

## 4. `validator.ts` — Validação

| Item | Status |
|---|---|
| Validar que `//@->` aponta para ID existente | ✅ |
| Validar hierarquia de sequence nodes | ✅ |
| Validar que grupos estão definidos | ✅ |
| Mensagens de erro descritivas | ✅ |

---

## 5. `generator.ts` — Geração do Diagrama

| Item do Plan | Status |
|---|---|
| Usar `saved diagram type` (do `//@::DiagramType`) | ✅ |
| Criar subgraph para cada grupo | ✅ |
| Renderizar entry/sequence nodes | ✅ |
| Arestas retro para sequence nodes | ✅ |
| Arestas de forward pointers | ✅ |
| Ordenação por ID numérico | ✅ |
| Cores temáticas dark/light | ✅ |

---

## 6. `diagram-command.ts` — Orquestração

| Etapa do Plan | Status |
|---|---|
| `ReadDiagramType` | ✅ |
| Pipeline modular | ✅ `extractCodeLine`, `processRetroPointers`, `processForwardPointers`, `filterAndSortNodes` |
| `Validate` completo | ✅ |
| `Display` com cores | ✅ |

---

## 7. `diagram-panel.ts` — Exibição (UI)

| Item | Status |
|---|---|
| Renderizar Mermaid em webview | ✅ |
| Tema dark/light | ✅ |
| **Botão "Copy"** | ✅ **Adicionado** |
| **Botão "Export SVG"** | ✅ **Adicionado** |

---

## 8. `decoration-manager.ts` — Decorações

| Item | Status |
|---|---|
| Mostrar ícone na margem | ✅ |
| Hover "Open diagram" | ✅ |

---

## Resumo Final

| Prioridade | Total | Concluídos |
|---|---|---|
| 🔴 Alta | 4 | ✅ 4/4 |
| 🟡 Média | 2 | ✅ 2/2 |
| 🟢 Baixa | 2 | ✅ 2/2 |
| **Total** | **8** | **✅ 8/8** |

---

## Pipeline Atual

```
ReadDiagramType[Read //@::DiagramType]            ✅ parser.readDiagramType()
    ↓
FilterGroups[Filter every node's group]           ✅ parser.filterGroups()
    ↓
FilterNodes[Filter all //@ tagged lines]          ✅ parser.filterAllNodes()
    ↓
ExtractCode[Extract code line below each tag]     ✅ identifier.formatCodeToLabel()
    ↓
FormatLabel[Format code into label]               ✅ identifier.formatCodeToLabel()
    ↓
SplitTypes[Split //@ from //@->]                   ✅ parser.splitNodes()
    ↓
RetroPointers → Filtering                          ✅ processRetroPointers() + generator
ForwardPointers → Filtering                         ✅ processForwardPointers() + generator
    ↓
BuildHierarchy                                     ✅ generator (sortedSequenceNodes)
    ↓
AssignConnections                                  ✅ generator (connections + description)
    ↓
WriteDiagram[...]                                   ✅ Usa diagramType do arquivo
    ↓
Validate                                            ✅ 3 validações (targets, pais, grupos)
    ↓
Display/Error                                       ✅ diagram-panel.ts + toolbar (Copy/Export SVG)