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

pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");

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

    /// The exported symbol must be `tree_sitter_vbnet` — see SYMBOL_NAME.
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

    #[test]
    fn test_queries_compile() {
        let language = LANGUAGE.into();
        tree_sitter::Query::new(&language, HIGHLIGHTS_QUERY).expect("highlights query");
    }
}
