// Identifiers, comments, and literals.
import { kw, kws } from './helpers.js';

// VB accepts typographic quotes as string delimiters.
const QUOTE = '["\\u201C\\u201D]';
const STRING_BODY = `${QUOTE}([^"\\u201C\\u201D]|${QUOTE}${QUOTE})*${QUOTE}`;

export default {
  _literal: ($) =>
    choice(
      $.integer_literal,
      $.floating_literal,
      $.string_literal,
      $.character_literal,
      $.date_literal,
      $.boolean_literal,
      $.nothing,
      $.interpolated_string_expression,
    ),

  integer_literal: (_) =>
    token(
      seq(
        choice(/&[hH][0-9a-fA-F_]+/, /&[oO][0-7_]+/, /&[bB][01_]+/, /[0-9][0-9_]*/),
        optional(choice(/[uU]?[sSiIlL]/, '%', '&')),
      ),
    ),

  floating_literal: (_) =>
    token(
      choice(
        seq(
          /[0-9][0-9_]*/,
          optional(seq('.', /[0-9][0-9_]*/)),
          optional(/[eE][+-]?[0-9]+/),
          /[fFrRdD@!#]/,
        ),
        seq(
          /[0-9][0-9_]*/,
          '.',
          /[0-9][0-9_]*/,
          optional(/[eE][+-]?[0-9]+/),
          optional(/[fFrRdD@!#]/),
        ),
        seq('.', /[0-9][0-9_]*/, optional(/[eE][+-]?[0-9]+/), optional(/[fFrRdD@!#]/)),
        seq(/[0-9][0-9_]*/, /[eE][+-]?[0-9]+/, optional(/[fFrRdD@!#]/)),
      ),
    ),

  string_literal: (_) => token(new RegExp(STRING_BODY)),

  character_literal: (_) => token(new RegExp(`${STRING_BODY}[cC]`)),

  date_literal: (_) => token(/#[^#\r\n]*#/),

  boolean_literal: (_) => kws('True', 'False'),

  nothing: (_) => kw('Nothing'),

  interpolated_string_expression: ($) =>
    seq(
      '$"',
      repeat(choice($.interpolated_text, $.interpolation)),
      alias(token.immediate('"'), '"'),
    ),

  interpolation: ($) =>
    seq(
      alias(token.immediate('{'), '{'),
      field('value', $._expression),
      optional(seq(',', field('alignment', $._expression))),
      optional(seq(':', field('format', $.interpolation_format))),
      '}',
    ),

  // Defined last on purpose: where a keyword and an identifier match the same
  // text and both are valid, the lexer takes the rule defined first, so every
  // keyword must come before this one.
  //
  // A plain name with an optional `$` or `%` type character (`Left$`), or a
  // bracketed name that may spell a keyword (`[Date]`).
  identifier: (_) =>
    /[\p{L}\p{Nl}_][\p{L}\p{Nl}\p{Nd}\p{Mn}\p{Mc}\p{Pc}\p{Cf}]*[$%]?|\[[^\]\r\n]+\]/,
};
