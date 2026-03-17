# ChainSolve Expression Language (CSEL)

CSEL is the formula language for ChainSolve's formula bar. When you click the **fx** toggle and type an expression followed by `=`, CSEL parses it and generates a subgraph of connected blocks on the canvas.

CSEL is intentionally minimal: it covers arithmetic, common math functions, and variable assignments. It is not Turing-complete — there are no loops, no mutation, and no recursion. Every CSEL expression terminates and produces a finite directed-acyclic graph.

---

## Quick examples

| Input | What it does |
|---|---|
| `1 + 2 =` | Creates `Number(1)`, `Number(2)`, `Add`, `Display` blocks |
| `sin(pi/4) =` | Creates `Constant(π)`, `Number(4)`, `Divide`, `Sin`, `Display` blocks |
| `x = 5; y = x * 2; y + 1 =` | Creates named blocks `x=5`, `y=x×2`, then `Add(y, 1)` → `Display` |
| `max(a, b, c) =` | Creates a variadic `Max` block with 3 inputs |
| `-3.14e-2` | Unary negation of a scientific notation number |

---

## Grammar (EBNF)

```
program     = statement { ';' statement }
statement   = assignment | display | expr

assignment  = IDENT '=' expr              (* creates a named Number block *)
display     = expr '='                    (* adds a Display block at the end *)
expr        = term { ('+' | '-') term }
term        = power { ('*' | '/') power }
power       = unary { '^' unary }        (* right-associative: 2^3^4 = 2^(3^4) *)
unary       = '-' unary | call
call        = IDENT '(' [ expr { ',' expr } ] ')' | primary
primary     = NUMBER | IDENT | '(' expr ')'
```

### Tokens

| Token | Description | Examples |
|---|---|---|
| `NUMBER` | Integer, decimal, or scientific notation | `42`, `3.14`, `1.5e-3`, `.5` |
| `IDENT` | Identifier — letters, digits, `_`, `.` (for namespaced ops), unicode | `sin`, `x`, `my_var`, `vec.sum` |
| `+` `-` `*` `/` `^` | Arithmetic operators | |
| `(` `)` | Parentheses for grouping or function calls | |
| `,` | Argument separator in function calls | |
| `=` | Assignment (when followed by expr) or display (when trailing) | |
| `;` | Statement separator | |

---

## Operator precedence (highest to lowest)

| Level | Operator(s) | Associativity | Example |
|---|---|---|---|
| 5 (highest) | Unary `-` | Right | `-x`, `--x` |
| 4 | `^` (power) | **Right** | `2^3^4` = `2^(3^4)` = `2^81` |
| 3 | `*` `/` | Left | `6 / 2 * 3` = `9` |
| 2 | `+` `-` | Left | `1 + 2 - 3` = `0` |
| 1 (lowest) | `=` `;` | — | Statement separators |

Parentheses override all precedence: `(1 + 2) * 3` = `9`.

---

## Functions

These names are recognised by the graph generator and mapped to their corresponding blocks:

| CSEL name | Block type | Notes |
|---|---|---|
| `sin(x)` | `sin` | |
| `cos(x)` | `cos` | |
| `tan(x)` | `tan` | |
| `asin(x)` | `asin` | |
| `acos(x)` | `acos` | |
| `atan(x)` | `atan` | |
| `sqrt(x)` | `sqrt` | |
| `abs(x)` | `abs` | |
| `ln(x)` | `ln` | Natural log |
| `log(x)` | `log10` | Base-10 log |
| `log10(x)` | `log10` | |
| `exp(x)` | `exp` | eˣ |
| `floor(x)` | `floor` | |
| `ceil(x)` | `ceil` | |
| `round(x)` | `round` | |
| `max(a, b, ...)` | `max` | Variadic (2-64 inputs) |
| `min(a, b, ...)` | `min` | Variadic (2-64 inputs) |

Unknown function names generate an `Unknown` block type (shown with an error badge until the block type is recognised by the engine).

---

## Variables and assignments

An **assignment** (`x = expr`) creates a named Number block with the expression's value. Subsequent uses of `x` in the same program reference the same block's output (same node ID) rather than creating a duplicate.

```
x = 5;          → Number block labelled "x" with value 5
y = x * 2;      → Multiply block: x × 2, labelled "y"
y + 1 =         → Add block: y + 1, then Display
```

Variable names are resolved within the current formula. They do not reference existing blocks on the canvas — to reference an existing block's output, wire it directly.

---

## Display (trailing `=`)

When the last statement in a program ends with `=`, a **Display** block is appended and wired to the final expression's output:

```
sin(pi/4) =    → generates: Constant(π) → Divide → Sin → Display
```

Without the trailing `=`, no Display block is added (useful for computing intermediate values in multi-statement programs).

---

## Numbers

Numbers are IEEE 754 double-precision floats. Supported formats:
- Integer: `42`, `0`, `-1`
- Decimal: `3.14`, `.5` (leading-dot form)
- Scientific notation: `1.5e3`, `2.1E-4`, `1e+10`

---

## Statement separation

Multiple statements are separated by semicolons. Trailing semicolons are ignored. Whitespace (spaces, tabs, newlines) is ignored everywhere.

```
x = 1; y = 2; x + y =
```

```
x = 1
y = 2
x + y =
```

Both produce identical graphs.

---

## Error handling

Parse errors report the character position and a human-readable message in the formula bar. The formula bar underlines the error position in red. The graph is not modified when an error occurs — the existing canvas is preserved.

Common errors:
- **`Expected rparen, got eof`** — unmatched open parenthesis
- **`Unexpected token: equals`** — `=` used where an expression is expected (e.g., `1 = 2`)
- **`Unexpected token: eof`** — expression ended prematurely (e.g., `1 +`)

---

## Implementation

| File | Purpose |
|---|---|
| `src/engine/csel/lexer.ts` | Tokenises input string into `Token[]` |
| `src/engine/csel/parser.ts` | Recursive descent parser producing `CselNode` AST |
| `src/engine/csel/graphGen.ts` | Walks AST → `GeneratedNode[]` + `GeneratedEdge[]` |
| `src/engine/csel/types.ts` | AST node type definitions |
| `src/components/canvas/FormulaBar.tsx` | UI: fx toggle, input field, error display |

The graph generator assigns `id = csel_nN` to each generated node and `id = csel_eN` to each edge. These IDs are deterministic within a single formula evaluation and are replaced by new UUIDs when the nodes are committed to the canvas.

---

## Limitations

- No boolean operators, comparisons, or ternary expressions (use `IfThenElse` blocks instead)
- No string literals
- No loops or recursion
- No user-defined functions (use composite blocks)
- Variable scope is local to the formula — no reference to existing canvas block outputs by name
