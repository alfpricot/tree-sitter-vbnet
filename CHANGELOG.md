# Changelog

## 1.0.0 (2026-11-27)

### Breaking Changes

* **scanner:** keep error recovery and reparsing local (#31)
* **grammar:** keep markup after a document root in the document (#30)
* **scanner:** skip a branch under a literally false #If condition (#26)
* **grammar:** parse XML document literals and namespace imports (#25)
* **scanner:** keep open strings and an open #Else from taking later code (#24)
* **scanner:** skip the later branches of an #If (#23)
* **grammar:** parse XML literals and XML axis properties (#22)
* **scanner:** accept comment lines between query clauses (#21)
* **scanner:** recover at the next member and fix reparse and queries (#20)
* **grammar:** follow the node naming rules and close any depth with Next (#19)
* **grammar:** parse one Next that closes two nested loops (#15)
* **grammar:** flatten label names and find directives after any line break (#12)
* **grammar:** highlight Of and add indent and injection queries (#9)
* **scanner:** accept Unicode spaces and typographic quotes in interpolated strings (#6)

### Features

* add Python and Go bindings and tag, local, and fold queries (#14)

### Bug Fixes

* **node:** type-check the binding and tighten lint, Rust checks, and install docs (#10)
* **release:** require prebuilds before publishing and loosen dependency pins (#8)
* **node:** fail at import without node metadata and deepen test and package checks (#7)

## 0.2.0 (2026-11-26)

### Features

* add tree-sitter grammar for Visual Basic .NET
