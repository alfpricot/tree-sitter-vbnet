// Files, namespaces, types, and type members.
import { comma_sep1, end_kw, kw, kws, open_paren_of } from './helpers.js';

// Member items separated by statement terminators.
function members($, item) {
  // A line may start with a stray `:` (`: Inherits Base`).
  return repeat(choice(seq(item, $._terminator), ':'));
}

// The leading attributes and modifiers every declaration accepts.
function prefix($) {
  return [repeat(field('attributes', $.attribute_list)), optional(field('modifiers', $.modifiers))];
}

// The attributes and modifiers of a `MustOverride` signature.
function signature_prefix($) {
  return [
    repeat(field('attributes', $.attribute_list)),
    field('modifiers', alias($._signature_modifiers, $.modifiers)),
  ];
}

// The `As` clause and the `Handles`/`Implements` tails of a method header.
function method_tail($) {
  return [
    optional(field('type_parameters', $.type_parameter_list)),
    optional(field('parameters', $.parameter_list)),
    optional($._return_type),
    optional(field('handles', $.handles_clause)),
    optional(field('implements', $.implements_clause)),
  ];
}

export default {
  source_file: ($) => members($, $._file_item),

  _file_item: ($) =>
    choice(
      $.option_statement,
      $.imports_statement,
      $.attribute_statement,
      $.namespace_block,
      $._type_declaration,
    ),

  option_statement: (_) =>
    seq(
      kw('Option'),
      choice(
        seq(
          field('name', kws('Strict', 'Explicit', 'Infer')),
          optional(field('value', kws('On', 'Off'))),
        ),
        seq(field('name', kw('Compare')), field('value', kws('Binary', 'Text'))),
      ),
    ),

  imports_statement: ($) => seq(kw('Imports'), comma_sep1($.imports_clause)),

  imports_clause: ($) =>
    choice(
      seq(field('alias', $.identifier), '=', field('name', $._type_name)),
      field('name', $._type_name),
      // `<xmlns="uri">` or `<xmlns:prefix="uri">`.
      seq('<', field('name', $.xml_name), '=', field('value', $.xml_attribute_value), '>'),
    ),

  // An assembly- or module-level attribute block on its own line.
  attribute_statement: ($) => seq('<', comma_sep1(alias($.global_attribute, $.attribute)), '>'),

  global_attribute: ($) =>
    seq(
      field('target', kws('Assembly', 'Module')),
      ':',
      field('name', $._type_name),
      optional(field('arguments', $.argument_list)),
    ),

  namespace_block: ($) =>
    seq(
      kw('Namespace'),
      field('name', $._type_name),
      $._terminator,
      members($, $._namespace_member),
      end_kw($, 'Namespace'),
    ),

  _namespace_member: ($) => choice($.namespace_block, $._type_declaration),

  _type_declaration: ($) =>
    choice(
      $.class_block,
      $.module_block,
      $.structure_block,
      $.interface_block,
      $.enum_block,
      $.delegate_declaration,
    ),

  class_block: ($) => type_block($, 'Class', $._class_member),
  module_block: ($) => type_block($, 'Module', $._class_member),
  structure_block: ($) => type_block($, 'Structure', $._class_member),
  interface_block: ($) => type_block($, 'Interface', $._interface_member),

  enum_block: ($) =>
    seq(
      ...prefix($),
      kw('Enum'),
      field('name', $.identifier),
      optional(seq(kw('As'), field('type', $._type))),
      $._terminator,
      members($, $.enum_member),
      end_kw($, 'Enum'),
    ),

  enum_member: ($) =>
    seq(
      repeat(field('attributes', $.attribute_list)),
      field('name', $.identifier),
      optional(seq('=', field('value', $._expression))),
    ),

  _class_member: ($) =>
    choice(
      $._type_declaration,
      $.inherits_statement,
      $.implements_statement,
      $.field_declaration,
      $.method_declaration,
      $.method_signature,
      $.constructor_declaration,
      $.operator_declaration,
      $.property_declaration,
      $.property_signature,
      $.event_declaration,
      $.custom_event_declaration,
      $.declare_declaration,
    ),

  _interface_member: ($) =>
    choice(
      $._type_declaration,
      $.inherits_statement,
      alias($.interface_method, $.method_signature),
      alias($.interface_property, $.property_signature),
      $.event_declaration,
    ),

  inherits_statement: ($) => seq(kw('Inherits'), comma_sep1($._type)),
  implements_statement: ($) => seq(kw('Implements'), comma_sep1($._type)),

  modifiers: ($) => repeat1($.modifier),

  modifier: (_) =>
    kws(
      'Public',
      'Private',
      'Protected',
      'Friend',
      'Shared',
      'Shadows',
      'Overridable',
      'NotOverridable',
      'Overrides',
      'Overloads',
      'ReadOnly',
      'WriteOnly',
      'Default',
      'Partial',
      'MustInherit',
      'NotInheritable',
      'WithEvents',
      'Widening',
      'Narrowing',
      'Async',
      'Iterator',
      'Static',
      'Dim',
      'Const',
    ),

  // The modifiers of a signature, one of which is `MustOverride`.
  _signature_modifiers: ($) =>
    seq(repeat($.modifier), alias($._must_override, $.modifier), repeat($.modifier)),

  _must_override: (_) => kw('MustOverride'),

  field_declaration: ($) =>
    seq(
      repeat(field('attributes', $.attribute_list)),
      field('modifiers', $.modifiers),
      comma_sep1(field('declarator', $.variable_declarator)),
    ),

  method_declaration: ($) =>
    seq(
      ...prefix($),
      kws('Sub', 'Function'),
      field('name', $.identifier),
      ...method_tail($),
      $._terminator,
      optional(field('body', $.block)),
      end_kw($, 'Sub', 'Function'),
    ),

  // A `MustOverride` method, which has no body.
  method_signature: ($) =>
    seq(
      ...signature_prefix($),
      kws('Sub', 'Function'),
      field('name', $.identifier),
      ...method_tail($),
    ),

  interface_method: ($) =>
    seq(...prefix($), kws('Sub', 'Function'), field('name', $.identifier), ...method_tail($)),

  constructor_declaration: ($) =>
    seq(
      ...prefix($),
      kw('Sub'),
      field('name', kw('New')),
      optional(field('parameters', $.parameter_list)),
      $._terminator,
      optional(field('body', $.block)),
      end_kw($, 'Sub'),
    ),

  operator_declaration: ($) =>
    seq(
      ...prefix($),
      kw('Operator'),
      field(
        'operator',
        choice(
          '+',
          '-',
          '*',
          '/',
          '\\',
          '^',
          '&',
          '<<',
          '>>',
          '=',
          '<>',
          '<',
          '>',
          '<=',
          '>=',
          kws('Like', 'Mod', 'And', 'Or', 'Xor', 'Not', 'CType', 'IsTrue', 'IsFalse'),
        ),
      ),
      field('parameters', $.parameter_list),
      optional($._return_type),
      $._terminator,
      optional(field('body', $.block)),
      end_kw($, 'Operator'),
    ),

  property_declaration: ($) =>
    seq(
      ...property_header($),
      optional(seq($._accessor_newline, members($, $.accessor_declaration), end_kw($, 'Property'))),
    ),

  // A `MustOverride` property, which has no accessors.
  property_signature: ($) => seq(...signature_prefix($), ...property_header_rest($)),

  interface_property: ($) => seq(...property_header($)),

  accessor_declaration: ($) =>
    seq(
      ...prefix($),
      field('kind', kws('Get', 'Set')),
      optional(field('parameters', $.parameter_list)),
      $._terminator,
      optional(field('body', $.block)),
      end_kw($, 'Get', 'Set'),
    ),

  event_declaration: ($) =>
    seq(
      ...prefix($),
      kw('Event'),
      field('name', $.identifier),
      optional(
        choice(seq(kw('As'), field('type', $._type)), field('parameters', $.parameter_list)),
      ),
      optional(field('implements', $.implements_clause)),
    ),

  custom_event_declaration: ($) =>
    seq(
      ...prefix($),
      kw('Custom'),
      kw('Event'),
      field('name', $.identifier),
      kw('As'),
      field('type', $._type),
      optional(field('implements', $.implements_clause)),
      $._terminator,
      members($, $.event_accessor_declaration),
      end_kw($, 'Event'),
    ),

  event_accessor_declaration: ($) =>
    seq(
      repeat(field('attributes', $.attribute_list)),
      field('kind', kws('AddHandler', 'RemoveHandler', 'RaiseEvent')),
      field('parameters', $.parameter_list),
      $._terminator,
      optional(field('body', $.block)),
      end_kw($, 'AddHandler', 'RemoveHandler', 'RaiseEvent'),
    ),

  delegate_declaration: ($) =>
    seq(
      ...prefix($),
      kw('Delegate'),
      kws('Sub', 'Function'),
      field('name', $.identifier),
      optional(field('type_parameters', $.type_parameter_list)),
      optional(field('parameters', $.parameter_list)),
      optional($._return_type),
    ),

  declare_declaration: ($) =>
    seq(
      ...prefix($),
      kw('Declare'),
      optional(field('charset', kws('Ansi', 'Unicode', 'Auto'))),
      kws('Sub', 'Function'),
      field('name', $.identifier),
      kw('Lib'),
      field('library', $.string_literal),
      optional(seq(kw('Alias'), field('alias', $.string_literal))),
      optional(field('parameters', $.parameter_list)),
      optional($._return_type),
    ),

  _return_type: ($) =>
    seq(kw('As'), repeat(field('attributes', $.attribute_list)), field('return_type', $._type)),

  handles_clause: ($) => seq(kw('Handles'), comma_sep1($.event_reference)),

  event_reference: ($) =>
    seq(
      field('object', choice($.identifier, $.me, $.my_base, $.my_class)),
      repeat1(seq('.', field('event', $.identifier))),
    ),

  implements_clause: ($) => seq(kw('Implements'), comma_sep1($._type_name)),

  parameter_list: ($) => seq('(', optional(comma_sep1($.parameter)), ')'),

  _parameter_modifiers: ($) => repeat1(alias($._parameter_modifier, $.modifier)),

  _parameter_modifier: (_) => kws('Optional', 'ByVal', 'ByRef', 'ParamArray'),

  parameter: ($) =>
    seq(
      repeat(field('attributes', $.attribute_list)),
      optional(field('modifiers', alias($._parameter_modifiers, $.modifiers))),
      field('name', $.identifier),
      repeat($.array_rank_specifier),
      optional('?'),
      optional(seq(kw('As'), field('type', $._type))),
      optional(seq('=', field('default', $._expression))),
    ),

  type_parameter_list: ($) => seq(...open_paren_of($), comma_sep1($.type_parameter), ')'),

  type_parameter: ($) =>
    seq(
      optional(field('variance', kws('In', 'Out'))),
      field('name', $.identifier),
      optional(
        seq(
          kw('As'),
          choice(
            field('constraint', $._type_constraint),
            seq('{', comma_sep1(field('constraint', $._type_constraint)), '}'),
          ),
        ),
      ),
    ),

  _type_constraint: ($) => choice($.special_constraint, $._type),

  attribute_list: ($) => seq('<', comma_sep1($.attribute), '>'),

  attribute: ($) =>
    seq(
      optional(seq(field('target', kw('Return')), ':')),
      field('name', $._type_name),
      optional(field('arguments', $.argument_list)),
    ),

  variable_declarator: ($) =>
    prec.dynamic(
      1,
      prec.right(
        seq(
          field('name', $.identifier),
          // `a()`, `a(,)`, and `a(9)` all read as an argument list here.
          repeat(field('bounds', $.argument_list)),
          optional('?'),
          optional(
            choice(
              seq(kw('As'), field('type', $._type)),
              seq(kw('As'), field('value', $.object_creation_expression)),
            ),
          ),
          optional(seq('=', field('value', $._expression))),
        ),
      ),
    ),
};

function type_block($, keyword, member) {
  return seq(
    ...prefix($),
    kw(keyword),
    field('name', $.identifier),
    optional(field('type_parameters', $.type_parameter_list)),
    $._terminator,
    members($, member),
    end_kw($, keyword),
  );
}

function property_header($) {
  return [...prefix($), ...property_header_rest($)];
}

function property_header_rest($) {
  return [
    kw('Property'),
    field('name', $.identifier),
    optional(field('parameters', $.parameter_list)),
    optional(
      choice(
        seq(kw('As'), repeat(field('attributes', $.attribute_list)), field('type', $._type)),
        seq(kw('As'), field('value', $.object_creation_expression)),
      ),
    ),
    optional(seq('=', field('value', $._expression))),
    optional(field('implements', $.implements_clause)),
  ];
}
