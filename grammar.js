/**
 * @file Tree-sitter grammar for Visual Basic .NET.
 * @license MIT
 */

import declaration_rules from './grammar/declarations.js';
import statement_rules from './grammar/statements.js';
import expression_rules from './grammar/expressions.js';
import type_rules from './grammar/types.js';
import xml_rules from './grammar/xml.js';
import literal_rules from './grammar/literals.js';

export default grammar({
  name: 'vbnet',

  word: ($) => $.identifier,

  // `\s` covers only ASCII whitespace in the generated lexer, so the Unicode
  // spaces and line breaks the scanner knows are listed too.
  extras: ($) => [
    /[\s\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/,
    $.comment,
    $.preprocessor_directive,
    $.inactive_preprocessor_branch,
    $._line_continuation,
  ],

  // Order is the scanner's TokenType enum in src/scanner.c.
  externals: ($) => [
    // A line break that ends a statement. The scanner emits it only where the
    // parser can end a statement; anywhere else a line break is whitespace,
    // which is how implicit line continuation and blank lines work.
    $._newline,
    // The line break after a property header when the next line starts a
    // `Get` or `Set` accessor.
    $._accessor_newline,
    // A `#If`, `#Region`, `#Const`, ... line.
    $.preprocessor_directive,
    // `'`, a typographic single quote, or the word `REM`, to the end of the
    // line.
    $.comment,
    // ` _` at the end of a line, optionally followed by a comment, which joins
    // the next line to this one.
    $._line_continuation,
    // The `End` of `End Sub`, `End If`, ...: emitted only when a closing
    // keyword follows, so a bare `End` statement inside a block is a different
    // token.
    $._block_end,
    // The `End` of a line that closes a member or a type. It is its own token
    // so that one arriving inside an unclosed block is rejected at the `End`,
    // and recovery can drop the block and keep what follows.
    $._member_end,
    // The `(` of `(Of`, opening a type argument or type parameter list.
    $._open_paren_of,
    // Literal text inside `$"..."`, scanned here so a `'` in it is text and
    // not the start of a comment.
    $.interpolated_text,
    // The format after `:` in an interpolation, scanned for the same reason.
    $.interpolation_format,
    // Never produced: valid only where a query clause can follow, which tells
    // the scanner that a line break before a query keyword continues the
    // query.
    $._query_clause_follows,
    // The parts of an XML literal, scanned here because they can start like an
    // identifier or contain `'`: a name in a tag, the text between tags, an
    // attribute value in either kind of quote, and `<!-- -->`, `<![CDATA[ ]]>`,
    // and `<? ?>`, in an element's content or as expressions.
    $.xml_name,
    $.xml_text,
    $.xml_attribute_value,
    $.xml_comment,
    $.xml_cdata,
    $.xml_processing_instruction,
    // The `<?xml ...?>` that opens an XML document literal.
    $.xml_declaration,
    // The lines of an `#Else` or `#ElseIf` branch up to its `#End If`, which
    // are not parsed: the first branch of an `#If` is.
    $.inactive_preprocessor_branch,
    // Never used by a rule: it is only valid while the parser is recovering
    // from an error, which is how the scanner detects that.
    $._error_sentinel,
  ],

  conflicts: ($) => [
    [$.variable_declarator, $._primary_expression],
    [$.label_statement, $._primary_expression],
  ],

  rules: {
    ...declaration_rules,
    ...statement_rules,
    ...expression_rules,
    ...type_rules,
    ...xml_rules,
    // Last: it ends with `identifier`, which must follow every keyword.
    ...literal_rules,
  },
});
