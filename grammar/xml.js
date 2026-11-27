// XML literals and XML axis properties.
//
// Names, text, attribute values, comments, CDATA sections, and processing
// instructions are scanned by the external scanner: they can start like an
// identifier or contain `'`, which the generated lexer would read as the start
// of a comment, and an XML name token in the generated lexer would overlap
// `identifier` and keep keywords out of tree-sitter's keyword table. The one
// exception is a prefixed name after `.@`, which is a token only there and
// needs its `:`.
import { PREC } from './helpers.js';

// Each side of the `:` is a VB name, so a `.` or `-` ends it, as after a name
// with no prefix.
const NAME = /[\p{L}\p{Nl}_][\p{L}\p{Nl}\p{Nd}\p{Mn}\p{Mc}\p{Pc}\p{Cf}]*/.source;
const PREFIXED_NAME = new RegExp(`${NAME}:${NAME}`);

export default {
  // `<?xml ...?>`, any comments and processing instructions, and the root
  // element, which can be computed.
  xml_document: ($) =>
    seq(
      $.xml_declaration,
      repeat(choice($.xml_comment, $.xml_processing_instruction)),
      field('root', choice($.xml_element, $.xml_embedded_expression)),
    ),

  // `<name attr="value">content</name>` or `<name attr="value"/>`. The name
  // can be computed, `<<%= name %>>`, which then closes with `</>`.
  xml_element: ($) =>
    seq(
      '<',
      field('name', choice($.xml_name, $.xml_embedded_expression)),
      repeat($._xml_attribute),
      choice(
        '/>',
        seq('>', repeat($._xml_content), '</', optional(field('end_name', $.xml_name)), '>'),
      ),
    ),

  _xml_attribute: ($) => choice($.xml_attribute, $.xml_embedded_expression),

  xml_attribute: ($) =>
    seq(
      field('name', choice($.xml_name, $.xml_embedded_expression)),
      '=',
      field('value', choice($.xml_attribute_value, $.xml_embedded_expression)),
    ),

  _xml_content: ($) =>
    choice(
      $.xml_text,
      $.xml_element,
      $.xml_embedded_expression,
      $.xml_comment,
      $.xml_cdata,
      $.xml_processing_instruction,
    ),

  // `<%= expression %>`.
  xml_embedded_expression: ($) => seq('<%=', field('value', $._expression), '%>'),

  // `x.<child>`, `x...<descendant>`, `x.@attribute`, and `x.@<attribute>`,
  // with the object left out inside a `With` block.
  xml_axis_expression: ($) =>
    prec(
      PREC.postfix,
      seq(
        optional(field('object', $._primary_expression)),
        choice(
          seq(field('axis', choice('.', '...')), '<', field('name', $.xml_name), '>'),
          seq(
            field('axis', '.@'),
            choice(
              field('name', alias($.identifier, $.xml_name)),
              // `.@prefix:name`, written without spaces.
              field('name', alias(token.immediate(PREFIXED_NAME), $.xml_name)),
              seq('<', field('name', $.xml_name), '>'),
            ),
          ),
        ),
      ),
    ),
};
