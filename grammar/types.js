// Type names.
import { kw, kws, open_paren_of } from './helpers.js';

export default {
  _type: ($) => choice($._non_array_type, $.array_type),

  _non_array_type: ($) => choice($.primitive_type, $._type_name, $.nullable_type, $.tuple_type),

  // `(Integer, String)` or `(Count As Integer, Name As String)`.
  tuple_type: ($) => seq('(', $.tuple_element, repeat1(seq(',', $.tuple_element)), ')'),

  tuple_element: ($) =>
    choice(
      field('type', $._type),
      seq(field('name', $.identifier), kw('As'), field('type', $._type)),
    ),

  // A possibly qualified, possibly generic name.
  _type_name: ($) => choice($.identifier, $.generic_name, $.qualified_name, $.global),

  // Binds `.` tighter than member access, so `New A.B` creates an `A.B`.
  qualified_name: ($) =>
    prec(
      1,
      seq(
        field('qualifier', $._type_name),
        '.',
        field('name', choice($.identifier, $.generic_name)),
      ),
    ),

  generic_name: ($) =>
    seq(field('name', $.identifier), field('type_arguments', $.type_argument_list)),

  // `(Of T, U)`, or `(Of ,)` for an unbound generic type in `GetType`.
  type_argument_list: ($) =>
    seq(...open_paren_of($), optional($._type), repeat(seq(',', optional($._type))), ')'),

  array_type: ($) => seq(field('element', $._type), $.array_rank_specifier),

  array_rank_specifier: (_) => seq('(', repeat(','), ')'),

  nullable_type: ($) => seq(field('type', choice($.primitive_type, $._type_name)), '?'),

  primitive_type: (_) =>
    kws(
      'Boolean',
      'Byte',
      'Char',
      'Date',
      'Decimal',
      'Double',
      'Integer',
      'Long',
      'Object',
      'SByte',
      'Short',
      'Single',
      'String',
      'UInteger',
      'ULong',
      'UShort',
    ),

  special_constraint: (_) => kws('New', 'Class', 'Structure'),
};
