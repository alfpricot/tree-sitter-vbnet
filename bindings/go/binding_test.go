package tree_sitter_vbnet_test

import (
	"os"
	"testing"

	tree_sitter_vbnet "github.com/alfpricot/tree-sitter-vbnet/bindings/go"
	tree_sitter "github.com/tree-sitter/go-tree-sitter"
)

func TestParsesAFixtureWithoutErrors(t *testing.T) {
	source, err := os.ReadFile("../../test/fixtures/winforms-form.vb")
	if err != nil {
		t.Fatal(err)
	}
	parser := tree_sitter.NewParser()
	defer parser.Close()
	if err := parser.SetLanguage(tree_sitter.NewLanguage(tree_sitter_vbnet.Language())); err != nil {
		t.Fatal(err)
	}
	tree := parser.Parse(source, nil)
	defer tree.Close()
	if tree.RootNode().HasError() {
		t.Error("the fixture parsed with errors")
	}
}
