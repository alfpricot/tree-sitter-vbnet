//! This crate provides Visual Basic .NET support for the [tree-sitter][] parsing library.
//!
//! Typically, you will use the [LANGUAGE][] constant to add this language to a
//! tree-sitter [Parser][], and then use the parser to parse some code:
//!
//! ```
//! let code = "Module Program\n    Sub Main()\n        Console.WriteLine(\"Hello\")\n    End Sub\nEnd Module\n";
//! let mut parser = tree_sitter::Parser::new();
//! let language = tree_sitter_vbnet::LANGUAGE;
//! parser
//!     .set_language(&language.into())
//!     .expect("Error loading VB.NET parser");
//! let tree = parser.parse(code, None).unwrap();
//! assert!(!tree.root_node().has_error());
//! ```
//!
//! [Parser]: https://docs.rs/tree-sitter/*/tree_sitter/struct.Parser.html
//! [tree-sitter]: https://tree-sitter.github.io/

use tree_sitter_language::LanguageFn;

// Edition 2024 requires `extern` blocks to be marked `unsafe`: declaring a
// foreign symbol is itself the unsafe act, since nothing checks that the
// signature here matches the one the generated parser actually exports.
unsafe extern "C" {
    fn tree_sitter_vbnet() -> *const ();
}

/// The tree-sitter [`LanguageFn`][LanguageFn] for this grammar.
///
/// [LanguageFn]: https://docs.rs/tree-sitter-language/*/tree_sitter_language/struct.LanguageFn.html
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_vbnet) };

/// The content of the [`node-types.json`][] file for this grammar.
///
/// [`node-types.json`]: https://tree-sitter.github.io/tree-sitter/using-parsers#static-node-types
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");

/// The syntax highlighting query for this grammar.
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");

/// The query for resolving local names.
pub const LOCALS_QUERY: &str = include_str!("../../queries/locals.scm");

/// The symbol tagging query for this grammar.
pub const TAGS_QUERY: &str = include_str!("../../queries/tags.scm");

/// The folding query for this grammar.
pub const FOLDS_QUERY: &str = include_str!("../../queries/folds.scm");

/// The exported C symbol name, `tree_sitter_vbnet`. Another VB grammar
/// exports a different symbol (`tree_sitter_vb_dotnet`), so both can link
/// into one binary; the name is pinned here and asserted below.
pub const SYMBOL_NAME: &str = "tree_sitter_vbnet";

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(code: &str) -> tree_sitter::Tree {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&LANGUAGE.into())
            .expect("Error loading VB.NET parser");
        parser.parse(code, None).unwrap()
    }

    #[test]
    fn test_can_load_grammar() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&LANGUAGE.into())
            .expect("Error loading VB.NET parser");
    }

    /// The exported symbol must be `tree_sitter_vbnet` — see `SYMBOL_NAME`.
    #[test]
    fn test_exports_the_expected_symbol() {
        let parser_c = include_str!("../../src/parser.c");
        assert!(
            parser_c.contains("tree_sitter_vbnet(void)"),
            "generated parser no longer exports tree_sitter_vbnet"
        );
    }

    #[test]
    fn test_parses_crlf_line_endings() {
        let tree = parse(
            "Module M\r\n    Sub Main()\r\n        Dim x = 1\r\n    End Sub\r\nEnd Module\r\n",
        );
        assert!(!tree.root_node().has_error());
    }

    #[test]
    fn test_parses_a_file_without_a_final_line_break() {
        let tree = parse("Class C\n    Private x As Integer\nEnd Class");
        assert!(!tree.root_node().has_error());
    }

    /// Undoing an edit that split the space after `Rem` must give the tree a
    /// fresh parse gives: whether `Rem` starts a comment depends on the whole
    /// character after it.
    #[test]
    fn test_reparses_an_edit_inside_the_space_after_rem() {
        let code = "Module M\n    Sub S()\n        Rem\u{00A0}note\n    End Sub\nEnd Module\n";
        let mut parser = tree_sitter::Parser::new();
        parser.set_language(&LANGUAGE.into()).unwrap();
        let expected = parser.parse(code, None).unwrap();
        assert!(!expected.root_node().has_error());

        // Between the two bytes of the no-break space.
        let at = code.find('\u{00A0}').unwrap() + 1;
        let line = code.as_bytes()[..at]
            .iter()
            .rposition(|&b| b == b'\n')
            .unwrap()
            + 1;
        let start = tree_sitter::Point::new(2, at - line);
        let after = tree_sitter::Point::new(2, at - line + 1);
        let mut edited = code.as_bytes().to_vec();
        edited.insert(at, 0x8B);

        let mut tree = expected.clone();
        tree.edit(&tree_sitter::InputEdit {
            start_byte: at,
            old_end_byte: at,
            new_end_byte: at + 1,
            start_position: start,
            old_end_position: start,
            new_end_position: after,
        });
        let mut tree = parser.parse(&edited, Some(&tree)).unwrap();
        tree.edit(&tree_sitter::InputEdit {
            start_byte: at,
            old_end_byte: at + 1,
            new_end_byte: at,
            start_position: start,
            old_end_position: after,
            new_end_position: start,
        });
        let tree = parser.parse(code, Some(&tree)).unwrap();
        assert_eq!(tree.root_node().to_sexp(), expected.root_node().to_sexp());
    }

    /// A byte inserted inside a typographic quote and removed again must leave
    /// the tree a fresh parse gives. The closing quote of the string depends
    /// on the whole character after it, not only that character's first byte.
    #[test]
    fn test_reparses_an_edit_inside_a_typographic_quote() {
        let code = "Module M\n    Sub S()\n        t = $\u{201D}\u{201C}\u{201D}quoted\"\"\u{201C}\n    End Sub\nEnd Module\n";
        let mut parser = tree_sitter::Parser::new();
        parser.set_language(&LANGUAGE.into()).unwrap();
        let expected = parser.parse(code, None).unwrap();
        assert!(!expected.root_node().has_error());

        // The second byte of the third typographic quote.
        let at = code.find("\u{201D}quoted").unwrap() + 1;
        let before = &code.as_bytes()[..at];
        let column = at - before.iter().rposition(|&b| b == b'\n').unwrap() - 1;
        let row = before.split(|&b| b == b'\n').count() - 1;
        let start = tree_sitter::Point::new(row, column);
        let after = tree_sitter::Point::new(row, column + 1);
        let mut edited = code.as_bytes().to_vec();
        edited.insert(at, 0x8B);

        let mut tree = expected.clone();
        tree.edit(&tree_sitter::InputEdit {
            start_byte: at,
            old_end_byte: at,
            new_end_byte: at + 1,
            start_position: start,
            old_end_position: start,
            new_end_position: after,
        });
        let mut tree = parser.parse(&edited, Some(&tree)).unwrap();
        tree.edit(&tree_sitter::InputEdit {
            start_byte: at,
            old_end_byte: at + 1,
            new_end_byte: at,
            start_position: start,
            old_end_position: after,
            new_end_position: start,
        });
        let tree = parser.parse(code, Some(&tree)).unwrap();
        assert_eq!(tree.root_node().to_sexp(), expected.root_node().to_sexp());
    }

    #[test]
    fn test_queries_compile() {
        let language = LANGUAGE.into();
        for (name, query) in [
            ("highlights", HIGHLIGHTS_QUERY),
            ("locals", LOCALS_QUERY),
            ("tags", TAGS_QUERY),
            ("folds", FOLDS_QUERY),
        ] {
            tree_sitter::Query::new(&language, query).expect(name);
        }
    }
}
