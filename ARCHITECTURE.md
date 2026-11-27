# tree-sitter-vbnet architecture

tree-sitter-vbnet turns a Visual Basic .NET source file into a concrete syntax tree. It covers files, namespaces, types and their members, statements, expressions, LINQ queries, comments, and preprocessor lines, and it ships a highlight query with Node and Rust bindings.

The design choice that shapes everything else is how line breaks work. VB ends a statement at a line break, but a line break is only whitespace wherever the statement cannot end yet: after a comma, an open parenthesis, a binary operator, an attribute, an assignment, and so on. Rather than listing every place a line can continue, the grammar treats line breaks as whitespace and lets the external scanner emit a statement-ending `_newline` token only where the parser's valid-symbol list says a statement can end. One rule then covers implicit line continuation, blank lines, comment lines, and a missing final line break. The generated parser is committed so consumers never need the tree-sitter CLI.

## What tree-sitter-vbnet is not

- Not a compiler or type checker: it produces a syntax tree and attaches no meaning to names, imports, or `Option` settings.
- Not a preprocessor: `#If`/`#Else` lines are extras and both branches are parsed, so code that repeats a declaration's opening line in each branch produces an error.
- Not error-tolerant by design: a file it cannot parse yields `ERROR` nodes rather than a best-effort tree.
- Not complete yet: XML literals, XML axis properties, `Imports <xmlns:...>`, and `Next` closing several loops are not parsed.

## Major components

### [grammar.js](grammar.js) and [grammar/](grammar)

`grammar.js` declares the language, its extras, the external token list, and the few conflicts resolved at parse time, and merges the rule modules. `declarations.js` holds files, namespaces, types, and members; `statements.js` the statement forms and blocks; `expressions.js` expressions, lambdas, and queries; `types.js` type names; `literals.js` literals and `identifier`, which must stay the last rule so a keyword wins a tie with it; `helpers.js` the keyword helpers and the precedence table. The order of `externals` mirrors the scanner's `TokenType` enum.

Keywords are case-insensitive regular expressions aliased to their usual spelling (`kw('Dim')`). With `identifier` as the grammar's `word` rule, tree-sitter produces a keyword only where the parser can accept it, so VB's unreserved keywords cost nothing.

### [src/scanner.c](src/scanner.c)

The external scanner. It emits the statement-ending line break described above, and decides two cases where a line break the parser could accept as an end still continues the line: before a query clause keyword (`Where`, `Order`, `Select` but not `Select Case`, ...), and before a property's `Get`/`Set` accessors, which open a full property rather than end an auto-implemented one. It also scans the `(Of` that opens a type argument list, so `Foo(Of T)` and `Foo(x)` part on one token of lookahead; the `End` of a closing line (`End Sub`), so a bare `End` statement inside a block is a different token; `#` preprocessor lines at the start of a line; and comments, ` _` line continuations, and interpolated-string text and format. Comments, continuations, and `End` live in the scanner because each can start like an identifier, and in the generated lexer that overlap keeps tree-sitter from moving keywords into its keyword table, which slows every token down. The scanner keeps no state between tokens.

### [src/](src)

`parser.c`, `grammar.json`, and `node-types.json` are generated from `grammar.js` by `tree-sitter generate` and committed, along with the vendored `tree_sitter/` headers.

### [queries/](queries)

`highlights.scm` and `injections.scm`, registered in [tree-sitter.json](tree-sitter.json) together with the file type `vb`, and `indents.scm` for editors that use tree-sitter indentation. A tools test fails when a construct closed by an `End` line is missing from the indent query.

### [bindings/node](bindings/node) and [bindings/rust](bindings/rust)

The Node addon (`binding.cc`, built by `binding.gyp`, with `index.js` and `index.d.ts`) and the Rust crate (`lib.rs` and a `build.rs` that compiles the parser and scanner). Both expose the language and the highlight query.

### [test/](test) and [tools/](tools)

`test/corpus` asserts exact tree shapes, `test/highlight` asserts highlight captures, and `test/fixtures` holds whole files that must parse with no `ERROR`, `MISSING`, or zero-width nodes. `test/node-kinds.txt` snapshots the public node kinds and their field names. The `tools/` scripts run the fixture check, produce or check that snapshot, check the package contents and release policy, and `tools/bench.mjs` measures parse throughput over several corpora (statements, continued lines, comment lines, preprocessor lines, generics, interpolated strings, queries, and error recovery) so a grammar or scanner change can be compared before and after. `tools/parse-rate.mjs` reports the share of files under a directory that parse clean; the monthly `Parse rate` workflow runs it over public VB.NET code.

## External systems and data flow

There are no runtime services. Source text goes to the scanner and parser, which produce a tree that consumers walk or query with the highlight query.

## Build, test, release, and deploy

The `Verify` workflow ([.github/workflows/verify.yml](.github/workflows/verify.yml)) runs on pull requests, pushes to `dev` and `main`, and manual dispatch. It validates the pull request title, scans the working tree and Git history for secrets with Gitleaks, regenerates the parser and fails on drift in the generated files or the node-kind snapshot, lints and format-checks the JavaScript, runs the corpus, highlight and fixture checks, runs `cargo fmt`, `clippy` and `cargo test`, builds and tests the Node binding on Linux and Windows, and lints the workflow files with actionlint and checks every YAML file parses. A final job rolls these up into one `Verify` status. Dependabot proposes npm, Cargo and GitHub Actions updates weekly against `dev`. The `Gala release` workflow ([.github/workflows/gala-release.yml](.github/workflows/gala-release.yml)) runs [gala](https://github.com/alfpricot/gala) on pushes to `main`: from the Conventional Commits since the last `v*` tag it bumps the version in `Cargo.toml`, `package.json`, and `tree-sitter.json`, refreshes `package-lock.json`, regenerates the parser (whose metadata embeds the `tree-sitter.json` version), writes `CHANGELOG.md`, commits, tags, pushes, and fast-forwards `dev` to the release commit (see [.gala.toml](.gala.toml)). It then dispatches the `Release` workflow ([.github/workflows/release.yml](.github/workflows/release.yml)) for the new tag, which re-verifies the tagged commit, builds Node prebuilds for Linux and Windows and the WASM grammar, publishes the crate to crates.io and the npm package to npm and GitHub Packages, and creates the GitHub Release with the WASM build attached. The `Cleanup stale caches` workflow ([.github/workflows/cache-cleanup.yml](.github/workflows/cache-cleanup.yml)) runs daily and deletes Actions caches belonging to closed pull requests and deleted branches. Nothing is deployed.

## Where things live

| Path | Holds |
| --- | --- |
| `grammar.js`, `grammar/` | Grammar source |
| `src/` | External scanner and the generated, committed parser |
| `queries/` | Highlight query |
| `bindings/` | Node addon and Rust crate |
| `test/` | Corpus, highlight and fixture tests, node-kind snapshot |
| `tools/` | Fixture check, node-kind snapshot, package and release-policy checks, and the parse benchmark |
| `.github/` | `Verify`, `Gala release`, `Release`, and cache cleanup workflows, Dependabot and code owners |
