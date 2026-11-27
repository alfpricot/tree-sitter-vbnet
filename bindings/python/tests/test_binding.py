from pathlib import Path
from unittest import TestCase

import tree_sitter_vbnet
from tree_sitter import Language, Parser, Query

FIXTURE = Path(__file__).parents[3] / "test" / "fixtures" / "winforms-form.vb"


class TestLanguage(TestCase):
    def test_parses_a_fixture_without_errors(self):
        parser = Parser(Language(tree_sitter_vbnet.language()))
        tree = parser.parse(FIXTURE.read_bytes())
        self.assertEqual(tree.root_node.type, "source_file")
        self.assertFalse(tree.root_node.has_error)

    def test_queries_compile(self):
        language = Language(tree_sitter_vbnet.language())
        for name in tree_sitter_vbnet.__all__:
            if name != "language":
                with self.subTest(name):
                    Query(language, getattr(tree_sitter_vbnet, name))
