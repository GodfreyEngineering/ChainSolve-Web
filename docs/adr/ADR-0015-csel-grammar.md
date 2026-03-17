# ADR-0015: ChainSolve Expression Language (CSEL) Grammar and Parser Strategy

**Status:** Accepted
**Date:** 2026-03-17

---

## Context

ChainSolve blocks expose parameter fields that accept either literal values or expressions. As graphs grew more sophisticated, users needed the ability to reference other blocks' outputs, apply transformations, and compose nested function calls — all without leaving the parameter field. A formula bar experience (similar to a spreadsheet's `=` prefix) was the obvious UX pattern, but the implementation choices were non-trivial.

The key tension was between two evaluation philosophies: evaluate the expression directly in JavaScript/WASM and return a scalar, or parse the expression into a subgraph of ChainSolve blocks and wire it into the main graph. Direct evaluation is simpler to implement but creates a second evaluation path outside the Rust engine, fragmenting where computation lives and complicating debugging. Text-to-graph generation keeps computation entirely inside the Rust/WASM engine and makes every formula visible as a first-class part of the graph.

CSEL also needed to support a meaningful subset of mathematical notation without becoming a general-purpose language. The language had to remain learnable in under an hour, produce useful error messages at the formula bar level, and round-trip cleanly to and from a graph representation so that graphs built by drag-and-drop could be exported as CSEL expressions.

Parser tooling choices also mattered for the WASM target. Many popular parser-generator crates produce large binary artifacts and require build-script complexity. A hand-written recursive descent parser compiles to minimal WASM, produces precise error spans, and is straightforward to extend as the language grows.

---

## Decision

CSEL is a statically-typed expression language with the following grammar (EBNF summary):

```
program     ::= statement (';' statement)* '='?
statement   ::= assignment | expr
assignment  ::= IDENT '=' expr
expr        ::= ternary
ternary     ::= logical ('?' expr ':' expr)?
logical     ::= comparison (('&&' | '||') comparison)*
comparison  ::= addition (('==' | '!=' | '<' | '<=' | '>' | '>=') addition)?
addition    ::= multiplication (('+' | '-') multiplication)*
multiplication ::= power (('*' | '/' | '%') power)*
power       ::= unary ('^' unary)*
unary       ::= ('-' | '!') unary | primary
primary     ::= NUMBER | STRING | IDENT | call | '(' expr ')'
call        ::= IDENT '(' (expr (',' expr)*)? ')'
```

The parser is a **hand-written recursive descent parser** implemented in TypeScript (`src/engine/csel/parser.ts`). It operates on a token stream produced by a hand-written lexer. Error recovery uses a synchronization strategy: on a parse error, the parser emits a diagnostic with a byte-span and a human-readable message, then skips tokens until it finds a safe resync point (closing parenthesis, comma, or end-of-input), allowing multiple errors to be reported in a single parse pass.

**Text-to-graph lowering** is the canonical evaluation path. After parsing, a `graphGen` pass walks the AST and emits `GeneratedNode[]` + `GeneratedEdge[]` that are injected into the active canvas. For example:

```
sin(x * 2) + offset
```

lowers to: a `multiply` block (inputs: `x` var reference, `2.0`), a `sin` block (input: multiply output), an `add` block (inputs: sin output, `offset` var reference). The formula bar's generated subgraph is wired in with a `Display` block at the terminal expression.

Variable assignments (`x = 5; y = x * 2; y + 1 =`) create named Number blocks for each assignment; subsequent references to the same variable reuse the same node ID rather than creating duplicates.

CSEL is **not** Turing-complete by design: no loops, no mutation, and no recursion. All control flow is expression-level (ternary only). This ensures every CSEL expression terminates and the resulting subgraph is a finite DAG.

---

## Consequences

**Positive:**
- A single evaluation path: all computation, whether typed as CSEL or wired by drag-and-drop, flows through the same Rust/WASM engine, making behavior consistent and debuggable.
- The recursive descent parser in TypeScript has zero additional bundle weight beyond its own source (~5 KB gzip).
- Precise error spans in the formula bar allow character-level error highlighting.
- Variable reuse (same variable → same node) prevents accidental duplication of source blocks.
- CSEL round-trips: a simple formula can be typed, expanded to a graph, and inspected block-by-block.

**Negative / risks:**
- Text-to-graph lowering makes the graph larger for complex formulas. Users who type `sin(pi/4) =` get 3-4 blocks rather than a single expression node.
- Variable scoping is graph-global by default (CSEL references any named block by its label alias). This can cause surprising name collisions in large graphs.
- The grammar does not support user-defined functions. Power users wanting reusable formula abstractions must create composite blocks instead.
- Round-trip fidelity is approximate: layout positions are not preserved (auto-layout is applied to generated subgraphs).

---

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Direct JS expression evaluation (`eval` / `Function()`) | Runs outside the Rust engine, creates a second computation path, security footprint of `eval`, and loses type information needed for port type checking. |
| Parser generator (e.g., LALRPOP, nom) | LALRPOP requires a build script and generates substantial code; nom's combinator style makes error recovery and span tracking more complex than hand-written recursive descent. |
| Lua or JavaScript embedding | Full scripting languages are Turing-complete — CSEL expressions must be guaranteed to terminate. Embedding a runtime also adds significant WASM binary size. |
| Excel-style formula language | Cell-reference semantics (A1, B2) do not map to block-graph topology. Adapting the reference model would require a compatibility shim that obscures graph structure. |
