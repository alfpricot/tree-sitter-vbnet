// Expressions, lambdas, and query expressions.
import { comma_sep1, end_kw, kw, kws, PREC } from './helpers.js';

function binary($, precedence, operators, associativity = prec.left) {
  return associativity(
    precedence,
    seq(field('left', $._expression), field('operator', operators), field('right', $._expression)),
  );
}

const CONVERSIONS = [
  'CBool',
  'CByte',
  'CChar',
  'CDate',
  'CDbl',
  'CDec',
  'CInt',
  'CLng',
  'CObj',
  'CSByte',
  'CShort',
  'CSng',
  'CStr',
  'CUInt',
  'CULng',
  'CUShort',
];

export default {
  _expression: ($) =>
    choice(
      $._primary_expression,
      $.binary_expression,
      $.unary_expression,
      $.type_of_expression,
      $.await_expression,
      $.lambda_expression,
      $.query_expression,
    ),

  _primary_expression: ($) =>
    choice(
      $.identifier,
      // Query keywords are not reserved: `From` alone names a variable.
      alias(kws('From', 'Aggregate', 'Async', 'Iterator'), $.identifier),
      $.me,
      $.my_base,
      $.my_class,
      $.global,
      $.primitive_type,
      $._literal,
      $.parenthesized_expression,
      $.tuple_expression,
      $.member_access_expression,
      $.dictionary_access_expression,
      $.invocation_expression,
      $.generic_name,
      $.object_creation_expression,
      $.anonymous_object_creation_expression,
      $.collection_initializer,
      $.cast_expression,
      $.conversion_expression,
      $.get_type_expression,
      $.name_of_expression,
      $.ternary_expression,
      $.coalesce_expression,
      $.xml_element,
      $.xml_document,
      $.xml_comment,
      $.xml_cdata,
      $.xml_processing_instruction,
      $.xml_axis_expression,
    ),

  me: (_) => kw('Me'),
  my_base: (_) => kw('MyBase'),
  my_class: (_) => kw('MyClass'),
  global: (_) => kw('Global'),

  parenthesized_expression: ($) => seq('(', $._expression, ')'),

  tuple_expression: ($) => seq('(', $._tuple_element, repeat1(seq(',', $._tuple_element)), ')'),

  _tuple_element: ($) => choice($._expression, $.named_argument),

  // `a.b`, `a?.b`, and the `.b` form inside a `With` block.
  member_access_expression: ($) =>
    prec(
      PREC.postfix,
      seq(
        optional(field('object', $._primary_expression)),
        choice('.', '?.'),
        field('member', choice($.identifier, $.generic_name)),
      ),
    ),

  // `a!b`, a default-property lookup by name.
  dictionary_access_expression: ($) =>
    prec(
      PREC.postfix,
      seq(optional(field('object', $._primary_expression)), '!', field('key', $.identifier)),
    ),

  invocation_expression: ($) =>
    prec(
      PREC.postfix,
      seq(
        field('function', $._primary_expression),
        optional('?'),
        field('arguments', $.argument_list),
      ),
    ),

  argument_list: ($) =>
    seq('(', optional($._argument), repeat(seq(',', optional($._argument))), ')'),

  _argument: ($) => choice($._expression, $.named_argument, $.range_argument),

  named_argument: ($) => seq(field('name', $.identifier), ':=', field('value', $._expression)),

  // `0 To 9` in array bounds.
  range_argument: ($) => seq(field('low', $._expression), kw('To'), field('high', $._expression)),

  binary_expression: ($) =>
    choice(
      binary($, PREC.exponent, '^'),
      binary($, PREC.multiplicative, choice('*', '/')),
      binary($, PREC.integer_divide, '\\'),
      binary($, PREC.modulo, kw('Mod')),
      binary($, PREC.additive, choice('+', '-')),
      binary($, PREC.concat, '&'),
      binary($, PREC.shift, choice('<<', '>>')),
      binary(
        $,
        PREC.comparison,
        choice('=', '<>', '<', '>', '<=', '>=', kws('Is', 'IsNot', 'Like')),
      ),
      binary($, PREC.and, kws('And', 'AndAlso')),
      binary($, PREC.or, kws('Or', 'OrElse')),
      binary($, PREC.xor, kw('Xor')),
    ),

  unary_expression: ($) =>
    choice(
      prec(PREC.unary, seq(field('operator', choice('-', '+')), field('operand', $._expression))),
      prec(PREC.not, seq(field('operator', kw('Not')), field('operand', $._expression))),
      prec(
        PREC.postfix,
        seq(field('operator', kw('AddressOf')), field('operand', $._primary_expression)),
      ),
    ),

  await_expression: ($) => prec(PREC.await, seq(kw('Await'), $._expression)),

  type_of_expression: ($) =>
    prec.left(
      PREC.comparison,
      seq(
        kw('TypeOf'),
        field('value', $._primary_expression),
        field('operator', kws('Is', 'IsNot')),
        field('type', $._type),
      ),
    ),

  object_creation_expression: ($) =>
    prec.right(
      seq(
        kw('New'),
        field('type', choice($.primitive_type, $._type_name)),
        // `New T(9)() {}` builds a jagged array.
        repeat(field('arguments', $.argument_list)),
        optional(
          field(
            'initializer',
            choice(
              $.object_initializer,
              seq(kw('From'), $.collection_initializer),
              $.collection_initializer,
            ),
          ),
        ),
      ),
    ),

  anonymous_object_creation_expression: ($) =>
    seq(kw('New'), field('initializer', $.object_initializer)),

  object_initializer: ($) => seq(kw('With'), '{', comma_sep1($.field_initializer), '}'),

  field_initializer: ($) =>
    choice(
      seq(
        optional(kw('Key')),
        '.',
        field('name', $.identifier),
        '=',
        field('value', $._expression),
      ),
      seq(optional(kw('Key')), field('value', $._expression)),
    ),

  collection_initializer: ($) =>
    seq('{', optional(seq(comma_sep1($._expression), optional(','))), '}'),

  cast_expression: ($) =>
    seq(
      field('operator', kws('CType', 'DirectCast', 'TryCast')),
      '(',
      field('value', $._expression),
      ',',
      field('type', $._type),
      ')',
    ),

  conversion_expression: ($) =>
    seq(field('operator', kws(...CONVERSIONS)), '(', field('value', $._expression), ')'),

  get_type_expression: ($) => seq(kw('GetType'), '(', field('type', $._type), ')'),

  name_of_expression: ($) => seq(kw('NameOf'), '(', field('value', $._expression), ')'),

  // `If(condition, a, b)`.
  // Precedence over an `If` statement whose condition is a tuple.
  ternary_expression: ($) =>
    prec(
      1,
      seq(
        kw('If'),
        '(',
        field('condition', $._expression),
        ',',
        field('consequence', $._expression),
        ',',
        field('alternative', $._expression),
        ')',
      ),
    ),

  // `If(value, fallback)`.
  coalesce_expression: ($) =>
    prec(
      1,
      seq(kw('If'), '(', field('value', $._expression), ',', field('fallback', $._expression), ')'),
    ),

  lambda_expression: ($) =>
    choice(
      prec.right(
        PREC.lambda,
        seq(
          lambda_modifiers($),
          kw('Function'),
          field('parameters', $.parameter_list),
          field('body', $._expression),
        ),
      ),
      prec.right(
        PREC.lambda,
        seq(
          lambda_modifiers($),
          kw('Sub'),
          field('parameters', $.parameter_list),
          field('body', $._lambda_statement),
        ),
      ),
      seq(
        lambda_modifiers($),
        kws('Function', 'Sub'),
        field('parameters', $.parameter_list),
        optional(seq(kw('As'), field('return_type', $._type))),
        $._newline,
        optional(field('body', $.block)),
        end_kw($, 'Function', 'Sub'),
      ),
    ),

  _lambda_modifiers: ($) => repeat1(alias($._lambda_modifier, $.modifier)),

  _lambda_modifier: (_) => kws('Async', 'Iterator'),

  // The statements a single-line `Sub` lambda body takes. A narrower set
  // than a full line: every statement allowed here is repeated in each
  // expression context, which grows the parse table.
  _lambda_statement: ($) =>
    choice(
      $.assignment_statement,
      $.expression_statement,
      $.call_statement,
      $.throw_statement,
      $.raise_event_statement,
      $.add_handler_statement,
      $.remove_handler_statement,
    ),

  query_expression: ($) =>
    prec.right(PREC.query, seq(choice($.from_clause, $.aggregate_clause), following_clauses($))),

  _query_clause: ($) =>
    choice(
      $.from_clause,
      $.aggregate_clause,
      $.where_clause,
      $.select_clause,
      $.distinct_clause,
      $.order_by_clause,
      $.group_by_clause,
      $.join_clause,
      $.group_join_clause,
      $.let_clause,
      $.partition_clause,
    ),

  from_clause: ($) => prec.right(seq(kw('From'), comma_sep1($.range_variable))),

  aggregate_clause: ($) =>
    prec.right(
      seq(kw('Aggregate'), comma_sep1($.range_variable), following_clauses($), $.into_clause),
    ),

  range_variable: ($) =>
    seq(
      field('name', $.identifier),
      optional(seq(kw('As'), field('type', $._type))),
      kw('In'),
      field('collection', $._expression),
    ),

  where_clause: ($) => seq(kw('Where'), $._expression),

  select_clause: ($) => prec.right(seq(kw('Select'), comma_sep1($._expression))),

  distinct_clause: (_) => kw('Distinct'),

  order_by_clause: ($) => prec.right(seq(kw('Order'), kw('By'), comma_sep1($.ordering))),

  ordering: ($) =>
    prec.right(seq($._expression, optional(field('direction', kws('Ascending', 'Descending'))))),

  group_by_clause: ($) =>
    seq(
      kw('Group'),
      optional(field('items', comma_sep1($._expression))),
      kw('By'),
      field('keys', comma_sep1($._expression)),
      $.into_clause,
    ),

  join_clause: ($) =>
    prec.right(seq(kw('Join'), $.range_variable, repeat($.join_clause), ...join_on($))),

  // Primary operands, so the `And` between two conditions is not read as
  // a Boolean `And` inside the right operand.
  join_condition: ($) =>
    seq(field('left', $._primary_expression), kw('Equals'), field('right', $._primary_expression)),

  group_join_clause: ($) =>
    seq(kw('Group'), kw('Join'), $.range_variable, ...join_on($), $.into_clause),

  into_clause: ($) => prec.right(seq(kw('Into'), comma_sep1($.aggregation))),

  // `Into Total = Sum(x)` names the aggregate rather than comparing.
  aggregation: ($) =>
    choice(
      prec(
        PREC.postfix + 1,
        seq(field('name', $.identifier), '=', field('value', choice(kw('Group'), $._expression))),
      ),
      kw('Group'),
      $._expression,
    ),

  let_clause: ($) =>
    prec.right(
      seq(
        kw('Let'),
        comma_sep1(seq(field('name', $.identifier), '=', field('value', $._expression))),
      ),
    ),

  partition_clause: ($) =>
    seq(field('kind', kws('Skip', 'Take')), optional(kw('While')), $._expression),
};

function lambda_modifiers($) {
  return optional(field('modifiers', alias($._lambda_modifiers, $.modifiers)));
}

// The clauses that may follow a query's first one.
function following_clauses($) {
  return repeat(seq(optional($._query_clause_follows), $._query_clause));
}

// `On a Equals b [And c Equals d]`, the conditions of a join.
function join_on($) {
  return [kw('On'), $.join_condition, repeat(seq(kw('And'), $.join_condition))];
}
