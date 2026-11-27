// Package tree_sitter_vbnet provides the Visual Basic .NET grammar for
// tree-sitter.
package tree_sitter_vbnet

// #cgo CFLAGS: -std=c11 -fPIC
// #include "../../src/parser.c"
// #include "../../src/scanner.c"
import "C"

import "unsafe"

// Language returns the tree-sitter language for this grammar.
func Language() unsafe.Pointer {
	return unsafe.Pointer(C.tree_sitter_vbnet())
}
