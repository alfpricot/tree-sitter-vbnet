# tree-sitter-vbnet

[![Verify](https://github.com/alfpricot/tree-sitter-vbnet/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/alfpricot/tree-sitter-vbnet/actions/workflows/verify.yml)

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for Visual Basic .NET (`.vb` files). It follows VB's line rules the way the compiler does: a line break ends a statement only where a statement can end, so implicit line continuation, blank lines, and comment lines anywhere in a block parse without special cases. Keywords match in any letter case and are reserved only where the language uses them, so `x.Select`, `Dim text As String`, and `formX = 1` are ordinary identifiers. A file the grammar cannot parse produces `ERROR` nodes, never a permissive best-effort tree.

## Installation

Install from npm or crates.io:

```sh
npm install tree-sitter-vbnet tree-sitter
cargo add tree-sitter-vbnet
```

The Python and Go bindings are in this repository but not yet published to PyPI. Install the Python one from Git, and get the Go module with `go get`:

```sh
pip install "tree-sitter-vbnet[core] @ git+https://github.com/alfpricot/tree-sitter-vbnet"
go get github.com/alfpricot/tree-sitter-vbnet@dev
```

The generated parser (`src/parser.c`, `src/grammar.json`, `src/node-types.json`) is committed, so consumers build the C parser without the tree-sitter CLI. `src/scanner.c` must be compiled with it: it decides which line breaks end a statement and scans comments, line continuations, preprocessor lines, and interpolated-string text. The C symbol is `tree_sitter_vbnet`.

### Requirements

- Node.js 24 or newer for the Node binding (see `.nvmrc`). The npm package carries prebuilt addons for Linux x64 (glibc) and Windows x64; other platforms, musl-based Linux included, compile it on install and need a C/C++ toolchain.
- Rust 1.85 or newer, edition 2024, and a C compiler for the Rust crate.
- Python 3.10 or newer, `tree-sitter` 0.25 or newer, and a C compiler for the Python binding.
- Go 1.23 or newer with cgo for the Go binding.

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

Or from Python:

```python
import tree_sitter_vbnet
from tree_sitter import Language, Parser

parser = Parser(Language(tree_sitter_vbnet.language()))
tree = parser.parse(b"Class C\nEnd Class\n")
```

Or from Go, with `tree_sitter` as `github.com/tree-sitter/go-tree-sitter` and `tree_sitter_vbnet` as `github.com/alfpricot/tree-sitter-vbnet/bindings/go`:

```go
parser := tree_sitter.NewParser()
defer parser.Close()
parser.SetLanguage(tree_sitter.NewLanguage(tree_sitter_vbnet.Language()))
tree := parser.Parse([]byte("Class C\nEnd Class\n"), nil)
defer tree.Close()
```

### What it parses

- **Files**: `Option`, `Imports` (including aliases), assembly and module attributes, namespaces, a BOM, CRLF or LF line endings, and no line break at the end of the file.
- **Types**: classes, modules, structures, interfaces, and enums, nested in each other; `Inherits` and `Implements` on their own lines or after `:`; generic type parameters with variance and constraints; delegates.
- **Members**: fields (including `WithEvents`, `Const`, and array bounds), methods with `Handles` and `Implements` clauses, constructors, operators, auto-implemented and full properties with accessor modifiers, `MustOverride` members, events and `Custom Event` with its three accessors, and `Declare` statements.
- **Statements**: local declarations (`As New`, `With {...}`, `From {...}`, array bounds, nullable names), assignments and compound assignments, calls with or without `Call`, multi-line and single-line `If`, `Select Case` (`Case Is`, ranges, `Case Else`), `For`, `For Each` (including one `Next k, j, i` closing nested loops), `While`, `Do ... Loop`, `Try`/`Catch ... When`/`Finally`, `Using`, `With`, `SyncLock`, `Exit`, `Continue`, `Return`, `Throw`, `GoTo` and labels, `On Error`, `Resume`, `End`, `Stop`, `Erase`, `ReDim Preserve`, `AddHandler`, `RemoveHandler`, `RaiseEvent`, and `Yield`.
- **Expressions**: VB's operator precedence, `TypeOf ... Is`, `Is`/`IsNot`/`Like`, `CType`/`DirectCast`/`TryCast` and the `CInt`-style conversions, `If(...)` with two or three arguments, `GetType`, `NameOf`, `AddressOf`, `Await`, object, array, anonymous-type, and collection creation, `?.` and `?(...)`, `!` dictionary access, the `.Name` form inside `With`, named and omitted arguments, tuples and tuple types, single-line and multi-line lambdas, interpolated strings with alignment and format, and every literal form (hex, octal, and binary integers with type suffixes, floating point, characters, dates, and doubled quotes).
- **XML**: XML literals with attributes in either quote style, nested elements, text, `<%= ... %>` embedded expressions (including computed element and attribute names), comments, CDATA sections, processing instructions, and `</>`; document literals that open with `<?xml ...?>`; a comment, CDATA section, or processing instruction as an expression of its own; `Imports <xmlns:...>`; and the axis properties `x.<child>`, `x...<descendant>`, `x.@attribute`, and `x.@<attribute>`.
- **Queries**: `From`, `Where`, `Select`, `Order By`, `Group ... By ... Into`, `Join ... On ... Equals`, `Group Join`, `Let`, `Distinct`, `Skip`/`Take` (with `While`), and `Aggregate`, on one line or split across lines.
- **Comments and preprocessor lines**: `'`, typographic quotes, and `REM` comments wherever they occur, and every `#` directive (`#If`, `#Region`, `#Const`, ...) as a `preprocessor_directive` node, including outside a method. A branch under a condition that is literally `False` or `0` is skipped, as an `inactive_preprocessor_branch` node when it is not empty, and the first branch after it that is not literally false is parsed instead. Once a branch is parsed, the lines after the next `#ElseIf` or `#Else`, up to the `#End If`, are one `inactive_preprocessor_branch` node, which holds any later `#ElseIf` or `#Else` line of that `#If` and the directives nested in it. See [Choosing a branch](#choosing-a-branch) to parse another one.

An embedded expression whose last name or number touches `%>` (`<%= x%>`) is an error, as it is to the VB compiler: the `%` is that name's type character, so write `<%= x %>`. A document literal takes the comments and processing instructions after its root element, on the root's line or on the lines that follow, up to a line holding anything else, a `'` comment and a `#` line included. Inside parentheses and other places where no statement can end, such a line does not end the literal, although the VB compiler rejects it. No condition is evaluated apart from a literal `False` or `0`, so otherwise the first branch of an `#If` is parsed, even one such as `#If UNDONE` that your build never defines. Code that repeats a declaration's opening line in each branch parses, while code in a branch that is not parsed has no tree of its own. A branch is parsed when the directive line that would end it is missing. A line of a multi-line interpolated string that reads as the end of a member or a type (`End Sub`, with nothing but a comment or a `:` after it) is taken as that closing line, so a string left open does not take the members after it.

### Choosing a branch

The parser does not know which symbols your build defines. To parse a particular branch, give tree-sitter the ranges to read, leaving out the other branches and the `#If`, `#ElseIf`, `#Else`, and `#End If` lines around them:

```js
// Keep every line except the ones listed, counted from zero.
function without(source, skipped) {
  const ranges = [];
  let startIndex = 0;
  for (const [row, line] of source.split(/(?<=\n)/).entries()) {
    const endIndex = startIndex + line.length;
    if (!skipped.has(row)) {
      const startPosition = { row, column: 0 };
      const endPosition = { row: row + 1, column: 0 };
      ranges.push({ startIndex, endIndex, startPosition, endPosition });
    }
    startIndex = endIndex;
  }
  return ranges;
}

const source = '#If A Then\nImports X\n#Else\nImports Y\n#End If\n';
const tree = parser.parse(source, null, { includedRanges: without(source, new Set([0, 1, 2, 4])) });
```

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
          body: (block (return_statement (boolean_literal))))
        (assignment_statement left: (identifier) right: (identifier))
        (return_statement (boolean_literal))))))
```

### Queries

`queries/highlights.scm` covers keywords, types, declarations, calls, literals, comments, and preprocessor lines. `queries/tags.scm` lists namespaces, types, members, calls, and object creation for symbol navigation. `queries/locals.scm` marks scopes, definitions, and references for local names; it matches text exactly, so a name written in a different letter case than its declaration does not resolve. `queries/folds.scm` marks foldable constructs with `@fold`. The Node and Python bindings and the Rust crate expose these four as `HIGHLIGHTS_QUERY`, `TAGS_QUERY`, `LOCALS_QUERY`, and `FOLDS_QUERY`; the Go binding exposes the language only.

`queries/indents.scm` marks what indents and outdents for editors that use tree-sitter indentation, with `@indent.begin` and `@indent.branch` captures; a `Next j, i` line that closes several loops is indented at the level of the innermost `For`, deeper than the outer one, because those captures take back only one level per line. This limit is permanent. `queries/injections.scm` marks the pattern of `New Regex(...)` and `Regex.IsMatch(input, ...)` as `regex`; the range includes the surrounding quotes. Both ship in the npm package and the crate as files.

## How to contribute

Branch from `dev`, change the grammar under `grammar/` or in `grammar.js`, regenerate the parser, and run the checks. CI regenerates the parser and rejects drift in the generated files and the node-kind snapshot, and requires a Conventional Commit pull request title. Build steps, the full validation list, and pull request rules are in [CONTRIBUTING.md](CONTRIBUTING.md); the design is in [ARCHITECTURE.md](ARCHITECTURE.md).

## License

MIT. See [LICENSE](LICENSE); [NOTICE](NOTICE) credits the source of the test fixtures.
