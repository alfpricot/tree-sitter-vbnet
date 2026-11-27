# tree-sitter-vbnet

[![Verify](https://github.com/alfpricot/tree-sitter-vbnet/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/alfpricot/tree-sitter-vbnet/actions/workflows/verify.yml)

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for Visual Basic .NET (`.vb` files). It follows VB's line rules the way the compiler does: a line break ends a statement only where a statement can end, so implicit line continuation, blank lines, and comment lines anywhere in a block parse without special cases. Keywords match in any letter case and are reserved only where the language uses them, so `x.Select`, `Dim text As String`, and `formX = 1` are ordinary identifiers. A file the grammar cannot parse produces `ERROR` nodes, never a permissive best-effort tree.

## Installation

Install from npm or crates.io:

```sh
npm install tree-sitter-vbnet tree-sitter
cargo add tree-sitter-vbnet
```

The generated parser (`src/parser.c`, `src/grammar.json`, `src/node-types.json`) is committed, so consumers build the C parser without the tree-sitter CLI. `src/scanner.c` must be compiled with it: it decides which line breaks end a statement and scans comments, line continuations, preprocessor lines, and interpolated-string text. The C symbol is `tree_sitter_vbnet`.

### Requirements

- Node.js 24 or newer for the Node binding (see `.nvmrc`). The npm package carries prebuilt addons for Linux x64 (glibc) and Windows x64; other platforms, musl-based Linux included, compile it on install and need a C/C++ toolchain.
- Rust 1.85 or newer, edition 2024, and a C compiler for the Rust crate.

## Usage

Parse a file from Node:

```js
import Parser from 'tree-sitter';
import vbnet from 'tree-sitter-vbnet';

const parser = new Parser();
parser.setLanguage(vbnet);
const tree = parser.parse('Module M\n    Sub Main()\n        Console.WriteLine("Hi")\n    End Sub\nEnd Module\n');
```

Or from Rust:

```rust
let mut parser = tree_sitter::Parser::new();
parser
    .set_language(&tree_sitter_vbnet::LANGUAGE.into())
    .expect("Error loading VB.NET parser");
let tree = parser.parse("Class C\nEnd Class\n", None).unwrap();
```

### What it parses

- **Files**: `Option`, `Imports` (including aliases), assembly and module attributes, namespaces, a BOM, CRLF or LF line endings, and no line break at the end of the file.
- **Types**: classes, modules, structures, interfaces, and enums, nested in each other; `Inherits` and `Implements` on their own lines or after `:`; generic type parameters with variance and constraints; delegates.
- **Members**: fields (including `WithEvents`, `Const`, and array bounds), methods with `Handles` and `Implements` clauses, constructors, operators, auto-implemented and full properties with accessor modifiers, `MustOverride` members, events and `Custom Event` with its three accessors, and `Declare` statements.
- **Statements**: local declarations (`As New`, `With {...}`, `From {...}`, array bounds, nullable names), assignments and compound assignments, calls with or without `Call`, multi-line and single-line `If`, `Select Case` (`Case Is`, ranges, `Case Else`), `For`, `For Each`, `While`, `Do ... Loop`, `Try`/`Catch ... When`/`Finally`, `Using`, `With`, `SyncLock`, `Exit`, `Continue`, `Return`, `Throw`, `GoTo` and labels, `On Error`, `Resume`, `End`, `Stop`, `Erase`, `ReDim Preserve`, `AddHandler`, `RemoveHandler`, `RaiseEvent`, and `Yield`.
- **Expressions**: VB's operator precedence, `TypeOf ... Is`, `Is`/`IsNot`/`Like`, `CType`/`DirectCast`/`TryCast` and the `CInt`-style conversions, `If(...)` with two or three arguments, `GetType`, `NameOf`, `AddressOf`, `Await`, object, array, anonymous-type, and collection creation, `?.` and `?(...)`, `!` dictionary access, the `.Name` form inside `With`, named and omitted arguments, tuples and tuple types, single-line and multi-line lambdas, interpolated strings with alignment and format, and every literal form (hex, octal, and binary integers with type suffixes, floating point, characters, dates, and doubled quotes).
- **Queries**: `From`, `Where`, `Select`, `Order By`, `Group ... By ... Into`, `Join ... On ... Equals`, `Group Join`, `Let`, `Distinct`, `Skip`/`Take` (with `While`), and `Aggregate`, on one line or split across lines.
- **Comments and preprocessor lines**: `'`, typographic quotes, and `REM` comments wherever they occur, and every `#` directive (`#If`, `#Region`, `#Const`, ...) as a `preprocessor_directive` node, including outside a method.

Not covered yet: XML literals and XML axis properties (`<root/>`, `x.<child>`), `Imports <xmlns:...>`, and one `Next` closing several loops (`Next j, i`). The grammar parses both branches of `#If`/`#Else`, so code that repeats a declaration's opening line in each branch produces an error.

### Example

```vb
Public Class Account
    Inherits BaseAccount

    Public Function Deposit(amount As Decimal) As Boolean
        If amount <= 0 Then Return False
        balance += amount
        Return True
    End Function
End Class
```

```
(source_file
  (class_block
    modifiers: (modifiers (modifier))
    name: (identifier)
    (inherits_statement (identifier))
    (method_declaration
      modifiers: (modifiers (modifier))
      name: (identifier)
      parameters: (parameter_list (parameter name: (identifier) type: (primitive_type)))
      return_type: (primitive_type)
      body: (block
        (single_line_if_statement
          condition: (binary_expression left: (identifier) right: (integer_literal))
          consequence: (single_line_block (return_statement (boolean_literal))))
        (assignment_statement left: (identifier) right: (identifier))
        (return_statement (boolean_literal))))))
```

### Queries

`queries/highlights.scm` covers keywords, types, declarations, calls, literals, comments, and preprocessor lines. The Node binding exposes it as `HIGHLIGHTS_QUERY`; the Rust crate as the `HIGHLIGHTS_QUERY` constant.

`queries/indents.scm` marks what indents and outdents for editors that use tree-sitter indentation, with `@indent.begin` and `@indent.branch` captures. `queries/injections.scm` marks the pattern of `New Regex(...)` and `Regex.IsMatch(input, ...)` as `regex`; the range includes the surrounding quotes. Both ship in the npm package and the crate as files.

## How to contribute

Branch from `dev`, change the grammar under `grammar/` or in `grammar.js`, regenerate the parser, and run the checks. CI regenerates the parser and rejects drift in the generated files and the node-kind snapshot, and requires a Conventional Commit pull request title. Build steps, the full validation list, and pull request rules are in [CONTRIBUTING.md](CONTRIBUTING.md); the design is in [ARCHITECTURE.md](ARCHITECTURE.md).

## License

MIT. See [LICENSE](LICENSE); [NOTICE](NOTICE) credits the source of the test fixtures.
