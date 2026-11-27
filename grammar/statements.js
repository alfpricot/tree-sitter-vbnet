// Statements inside method, accessor, and lambda bodies.
import { comma_sep1, end_kw, kw, kws, sep1 } from './helpers.js';

// `Case < x` leaves out `Is`. Where a `Case` value may follow, `<` could
// also open an XML literal, so the operators that start with `<` are their
// own tokens with precedence over that `<`: `Case <a/>` compares, as in VB.
// They share one precedence so `<=` and `<>` still win over `<` by length.
const LESS_THAN_CASE_OPERATORS = ['<', '<=', '<>'].map((operator) =>
  alias(token(prec(1, operator)), operator),
);

// A statement body that may be empty.
function body($) {
  return optional(field('body', $.block));
}

// A `For` line, up to and including its terminator.
function for_header($) {
  return [
    kw('For'),
    $._loop_variable,
    '=',
    field('start', $._expression),
    kw('To'),
    field('end', $._expression),
    optional(seq(kw('Step'), field('step', $._expression))),
    $._terminator,
  ];
}

// A `For Each` line, up to and including its terminator.
function for_each_header($) {
  return [
    kw('For'),
    kw('Each'),
    $._loop_variable,
    kw('In'),
    field('collection', $._expression),
    $._terminator,
  ];
}

export default {
  // A line break or a colon ends a statement.
  _terminator: ($) => choice($._newline, ':'),

  block: ($) => repeat1($._block_item),

  _block_item: ($) => choice(seq($._statement, $._terminator), $.label_statement, ':'),

  _statement: ($) =>
    choice(
      $._simple_statement,
      $.if_statement,
      $.select_statement,
      $.for_statement,
      $.for_each_statement,
      $.while_statement,
      $.do_statement,
      $.try_statement,
      $.with_statement,
      $.using_statement,
      $.sync_lock_statement,
    ),

  // Statements that fit on one line, and so can follow `Then` in a
  // single-line `If` or form the body of a single-line `Sub` lambda.
  _simple_statement: ($) =>
    choice(
      $.local_declaration,
      $.assignment_statement,
      $.expression_statement,
      $.call_statement,
      $.exit_statement,
      $.continue_statement,
      $.return_statement,
      $.throw_statement,
      $.goto_statement,
      $.on_error_statement,
      $.resume_statement,
      $.end_statement,
      $.stop_statement,
      $.erase_statement,
      $.redim_statement,
      $.add_handler_statement,
      $.remove_handler_statement,
      $.raise_event_statement,
      $.yield_statement,
      $.single_line_if_statement,
    ),

  local_declaration: ($) =>
    prec.right(
      seq(
        field('modifiers', alias($._local_modifiers, $.modifiers)),
        comma_sep1(field('declarator', $.variable_declarator)),
      ),
    ),

  _local_modifiers: ($) => repeat1(alias($._local_modifier, $.modifier)),

  _local_modifier: (_) => kws('Dim', 'Const', 'Static'),

  // Higher than comparison, so a single-line `Sub` lambda body `x = 1` is an
  // assignment.
  assignment_statement: ($) =>
    prec(
      1,
      seq(
        field('left', $._primary_expression),
        field('operator', choice('=', '+=', '-=', '*=', '/=', '\\=', '^=', '&=', '<<=', '>>=')),
        field('right', $._expression),
      ),
    ),

  expression_statement: ($) => choice($._primary_expression, $.await_expression),

  call_statement: ($) => seq(kw('Call'), $._expression),

  exit_statement: (_) =>
    seq(
      kw('Exit'),
      field(
        'kind',
        kws('Sub', 'Function', 'Property', 'Operator', 'For', 'Do', 'While', 'Select', 'Try'),
      ),
    ),

  continue_statement: (_) => seq(kw('Continue'), field('kind', kws('For', 'Do', 'While'))),

  return_statement: ($) => prec.right(seq(kw('Return'), optional($._expression))),

  throw_statement: ($) => prec.right(seq(kw('Throw'), optional($._expression))),

  goto_statement: ($) => seq(kw('GoTo'), field('label', $._label_name)),

  // `Name:` at the start of a line is a label, not a call ended by a colon.
  label_statement: ($) => prec.dynamic(1, seq(field('label', $.identifier), ':')),

  _label_name: ($) => choice($.identifier, $.integer_literal),

  on_error_statement: ($) =>
    seq(
      kw('On'),
      kw('Error'),
      choice(
        seq(kw('Resume'), kw('Next')),
        seq(kw('GoTo'), field('label', choice($._label_name, seq('-', $.integer_literal)))),
      ),
    ),

  resume_statement: ($) =>
    prec.right(seq(kw('Resume'), optional(choice(kw('Next'), field('label', $._label_name))))),

  end_statement: (_) => kw('End'),

  stop_statement: (_) => kw('Stop'),

  erase_statement: ($) => prec.right(seq(kw('Erase'), comma_sep1($._expression))),

  redim_statement: ($) =>
    prec.right(seq(kw('ReDim'), optional(kw('Preserve')), comma_sep1($._expression))),

  add_handler_statement: ($) =>
    seq(kw('AddHandler'), field('event', $._expression), ',', field('handler', $._expression)),

  remove_handler_statement: ($) =>
    seq(kw('RemoveHandler'), field('event', $._expression), ',', field('handler', $._expression)),

  raise_event_statement: ($) =>
    seq(
      kw('RaiseEvent'),
      field('event', $.identifier),
      optional(field('arguments', $.argument_list)),
    ),

  yield_statement: ($) => seq(kw('Yield'), $._expression),

  single_line_if_statement: ($) =>
    prec.right(
      seq(
        kw('If'),
        field('condition', $._expression),
        kw('Then'),
        field('body', alias($._single_line_block, $.block)),
        optional(alias($._single_line_else_clause, $.else_clause)),
      ),
    ),

  _single_line_block: ($) => prec.right(sep1($._simple_statement, ':')),

  _single_line_else_clause: ($) =>
    prec.right(seq(kw('Else'), field('body', alias($._single_line_block, $.block)))),

  if_statement: ($) =>
    seq(
      kw('If'),
      field('condition', $._expression),
      optional(kw('Then')),
      $._terminator,
      body($),
      repeat($.elseif_clause),
      optional($.else_clause),
      end_kw($, 'If'),
    ),

  elseif_clause: ($) =>
    seq(
      choice(kw('ElseIf'), seq(kw('Else'), kw('If'))),
      field('condition', $._expression),
      optional(kw('Then')),
      $._terminator,
      body($),
    ),

  else_clause: ($) => seq(kw('Else'), $._terminator, body($)),

  select_statement: ($) =>
    seq(
      kw('Select'),
      optional(kw('Case')),
      field('value', $._expression),
      $._terminator,
      repeat($.case_branch_clause),
      optional($.case_else_clause),
      end_kw($, 'Select'),
    ),

  case_branch_clause: ($) => seq(kw('Case'), comma_sep1($.case_clause), $._terminator, body($)),

  case_else_clause: ($) => seq(kw('Case'), kw('Else'), $._terminator, body($)),

  case_clause: ($) =>
    choice(
      field('value', $._expression),
      seq(field('low', $._expression), kw('To'), field('high', $._expression)),
      seq(
        optional(kw('Is')),
        field('operator', choice('=', '>', '>=', ...LESS_THAN_CASE_OPERATORS)),
        field('value', $._expression),
      ),
    ),

  for_statement: ($) => seq(...for_header($), $._loop_end),

  for_each_statement: ($) => seq(...for_each_header($), $._loop_end),

  // A loop is closed by its own `Next`, or it ends with a nested loop whose
  // `Next j, i` closes it too.
  _loop_end: ($) => choice(seq(body($), $._next), $._shared_next_end),

  // Statements ending in a nested loop, then this loop's variable on that
  // loop's `Next` line.
  _shared_next_end: ($) =>
    seq(field('body', alias($._shared_next_block, $.block)), ',', $._expression),

  // The nested loop either owns the `Next` line, naming its variable there, or
  // is itself closed by a loop nested one level further in. Neither is followed
  // by a terminator.
  _shared_next_block: ($) =>
    seq(
      repeat($._block_item),
      choice(
        alias($._named_next_for, $.for_statement),
        alias($._named_next_for_each, $.for_each_statement),
        alias($._shared_next_for, $.for_statement),
        alias($._shared_next_for_each, $.for_each_statement),
      ),
    ),

  _named_next_for: ($) => seq(...for_header($), body($), $._named_next),

  _named_next_for_each: ($) => seq(...for_each_header($), body($), $._named_next),

  _named_next: ($) => seq(kw('Next'), $._expression),

  _shared_next_for: ($) => seq(...for_header($), $._shared_next_end),

  _shared_next_for_each: ($) => seq(...for_each_header($), $._shared_next_end),

  _loop_variable: ($) =>
    seq(field('variable', $.identifier), optional(seq(kw('As'), field('type', $._type)))),

  _next: ($) => prec.right(seq(kw('Next'), optional($._expression))),

  while_statement: ($) =>
    seq(kw('While'), field('condition', $._expression), $._terminator, body($), end_kw($, 'While')),

  do_statement: ($) =>
    seq(
      kw('Do'),
      optional($._loop_condition),
      $._terminator,
      body($),
      kw('Loop'),
      optional($._loop_condition),
    ),

  _loop_condition: ($) =>
    seq(field('kind', kws('While', 'Until')), field('condition', $._expression)),

  try_statement: ($) =>
    seq(
      kw('Try'),
      $._terminator,
      body($),
      repeat($.catch_clause),
      optional($.finally_clause),
      end_kw($, 'Try'),
    ),

  catch_clause: ($) =>
    seq(
      kw('Catch'),
      optional(seq(field('name', $.identifier), optional(seq(kw('As'), field('type', $._type))))),
      optional(seq(kw('When'), field('filter', $._expression))),
      $._terminator,
      body($),
    ),

  finally_clause: ($) => seq(kw('Finally'), $._terminator, body($)),

  with_statement: ($) =>
    seq(kw('With'), field('object', $._expression), $._terminator, body($), end_kw($, 'With')),

  using_statement: ($) =>
    seq(
      kw('Using'),
      choice(
        comma_sep1(field('declarator', $.variable_declarator)),
        field('resource', $._expression),
      ),
      $._terminator,
      body($),
      end_kw($, 'Using'),
    ),

  sync_lock_statement: ($) =>
    seq(
      kw('SyncLock'),
      field('lock', $._expression),
      $._terminator,
      body($),
      end_kw($, 'SyncLock'),
    ),
};
