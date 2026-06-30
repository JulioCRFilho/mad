# MAD — Mermaid Auto-Doccing

## O que é

Extensão VS Code que transforma comentários `//@` em diagramas Mermaid automaticamente.

## Como funciona

1. Você edita tags `//@` no código
2. Salva o arquivo (Ctrl+S / Cmd+S)
3. Extensão detecta o save, re-parseia tudo, regenera o diagrama
4. Diagrama é salvo em `/tmp/mad-diagram.mermaid`
5. Você valida o resultado

**Não há comandos manuais.** Qualquer alteração nas tags + save = diagrama atualizado.

## Regras fundamentais

1. **Primeira linha**: `//@::DiagramType` (ex: `//@::graph LR`)
2. **Tags `//@`**: viram nós ou conexões
3. **Tags sem `@`**: REMOVA (não use `//` puro)
4. **Documentação no código**: NUNCA crie arquivos `.md` externos

## Tipos de diagrama

```typescript
//@::graph LR          // Flowchart (esquerda → direita)
//@::graph TD          // Flowchart (topo → baixo)
//@::sequenceDiagram   // Sequência
//@::classDiagram      // Classes
//@::stateDiagram-v2   // Estados
//@::erDiagram         // Entidade-relacionamento
```

## Sistema de nomes

### Grupos (sem números)
```typescript
//@Auth
```
Viram: `subgraph` (flowchart), `class` (classDiagram), `participant` (sequence), `state` (state), entidade (ER)

### Nós numerados
```typescript
//@Auth1:Label           // Entry node (nível 1)
//@Auth1.1:Label         // Sub-step (nível 2)
//@Auth1.1.2:Label       // Sub-sub-step (nível 3)
//@Node_1:Label          // Synthetic node (underscore)
```

**Regras de numeração:**
- `Name1` → entry node
- `Name1.1` → sequence do anterior
- `Name1.1.1` → terceiro nível
- `Name_1` → synthetic (fora de subgraphs)
- Ordenados automaticamente por número

## Tags suportadas

### Nós
```typescript
//@Group                    // Grupo simples
//@Group1:Label             // Entry node com label
//@Group1.1:Label           // Sub-step
//@Node_1:Label             // Synthetic node
```

### Conexões implícitas (source = contexto atual)
```typescript
//@->Target:Label           // Dentro de método, conecta ao nó acima
```

### Conexões explícitas (source definido)
```typescript
//@Source->Target:Label     // Com source explícito
//@Source-->Target:Label    // Mesmo que acima (--> é alias)
```

### ClassDiagram (setas UML)
```typescript
//@Source-->Target:Label    // Associação (linha sólida)
//@Source<|--Target:Label   // Herança (triângulo vazio)
//@Source*--Target:Label    // Composição (diamante cheio)
//@Sourceo--Target:Label    // Agregação (diamante vazio)
//@<|--Target:Label         // Herança (sem source, usa grupo pai)
//@*--Target:Label          // Composição (sem source, usa grupo pai)
//@o--Target:Label          // Agregação (sem source, usa grupo pai)
```

### SequenceDiagram
```typescript
//@->>Target:Label          // Double arrow (->>)
```

## Onde colocar cada tag

| Tag | Posição | Exemplo |
|-----|---------|---------|
| `//@Group` | Acima da classe/função | `//@Auth` acima de `class AuthService` |
| `//@Group1:Label` | Acima do método | `//@Auth1:Login` acima de `async login()` |
| `//@Group1.1:Label` | Dentro do método | `//@Auth1.1:Verify` dentro de `login()` |
| `//@->Target:Label` | Dentro do método, no ponto de chamada | `//@->Dashboard:Show` onde dashboard é chamado |
| `//@Source->Target:Label` | Entre grupos (nível arquivo) | `//@Entry->Auth:Main flow` |

## Regras de ouro

1. **Tags devem levar a código real**: Tags devem estar ACIMA de código implementado (função, classe, etc.)
2. **Uma tag por nó**: Apenas um `//@ID` por nó
3. **Hierarquia numérica**: Não pule números (1, 1.1, 1.1.1 — não 1, 1.3)
4. **Labels curtos**: Máximo 3-4 palavras

## Validação

Após salvar, leia `/tmp/mad-diagram.mermaid`:

```bash
cat /tmp/mad-diagram.mermaid
```

### Se houver problemas de validação
```
%%% VALIDATION ISSUES (2)
%%%   - Tags(9) ≠ Diagrama(8)
%%%   - Conexões(10) ≠ Diagrama(9)
%%% END VALIDATION

graph LR
    ...código do diagrama...
```

**Ação**: Corrija as tags indicadas, salve, repita.

### Motivos comuns de falha
- **Flowchart**: Deduplicação de edges (tags duplicadas viram uma só)
- **Sequence**: Entry nodes viram self-messages (contam como conexões)
- **Class**: Apenas grupos são contados como nós (não métodos)

## Workflow correto

```typescript
// 1. Defina o tipo
//@::graph LR

// 2. Defina grupos
//@Entry
//@Auth
//@Dashboard

// 3. Adicione nós numerados
//@Entry1:Handle login
//@Auth1:Authenticate

// 4. Adicione conexões
//@->Auth1:Authenticate

// 5. Salve (Ctrl+S / Cmd+S)

// 6. Valide
// cat /tmp/mad-diagram.mermaid

// 7. Se erros: ajuste tags → salve → repita
// Se OK: próxima tag
```

## Troubleshooting

### Diagrama não atualiza
- Verifique se salvou o arquivo (Ctrl+S / Cmd+S)
- Verifique se a primeira linha é `//@::type`
- Verifique se há tags `//@` no arquivo

### Tag não aparece no diagrama
- Verifique se está acima de código (não flutuando)
- Verifique a sintaxe: `//@ID:Label` ou `//@->Target:Label`
- Verifique o número: `Name1` (não `Name01` ou `Name_1` a não ser que queira synthetic)

### Conexão não aparece
- Verifique se o target existe como nó
- Verifique a seta: `->`, `-->`, `*--`, `<|--`, `o--`
- Para classDiagram: associe ao grupo correto

### Validação falha
- Leia os `%%% VALIDATION ISSUES` no topo do arquivo
- Ajuste as tags conforme indicado
- Lembre-se: flowchart deduplica edges

## Exemplos completos

Veja a pasta `examples/`:
- `01-flowchart-login.ts` — Flowchart com login, 2FA, rate limiting
- `02-sequence-api.js` — Sequência de API request/response
- `03-class-diagram-oop.py` — Herança e composição
- `04-state-machine-login.js` — State machine
- `05-er-database.sql` — Entidades e relacionamentos

## Checklist final

Antes de entregar, verifique:

- [ ] Primeira linha é `//@::type`?
- [ ] Todas tags têm código abaixo (não flutuam)?
- [ ] Nós numerados corretamente (1, 1.1, 1.1.1)?
- [ ] Labels são curtos e descritivos?
- [ ] Leu `/tmp/mad-diagram.mermaid` e está correto?
- [ ] Sem `%%% VALIDATION ISSUES` no topo?
- [ ] Diagrama faz sentido lógico?