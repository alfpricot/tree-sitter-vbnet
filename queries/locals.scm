; Scopes, definitions, and references for resolving local names. VB names
; ignore letter case, but a locals query matches text exactly, so a reference
; spelled in another case does not resolve to its definition.

; Scopes

[
  (class_block)
  (module_block)
  (structure_block)
  (interface_block)
  (method_declaration)
  (method_signature)
  (constructor_declaration)
  (operator_declaration)
  (property_declaration)
  (accessor_declaration)
  (event_accessor_declaration)
  (lambda_expression)
  (block)
  (single_line_block)
  (for_statement)
  (for_each_statement)
  (using_statement)
  (catch_block)
  (query_expression)
] @local.scope

; Definitions

(parameter name: (identifier) @local.definition)
(type_parameter name: (identifier) @local.definition)
(variable_declarator name: (identifier) @local.definition)

; A loop variable with its own `As` type is declared by the loop; without one
; it names a variable declared elsewhere.
(for_statement
  variable: (identifier) @local.definition
  type: (_))
(for_each_statement
  variable: (identifier) @local.definition
  type: (_))

(catch_block name: (identifier) @local.definition)
(range_variable name: (identifier) @local.definition)
(let_clause name: (identifier) @local.definition)
(aggregation name: (identifier) @local.definition)

; References: identifiers read as values. Member names after a `.` are not
; local names.

(argument_list (identifier) @local.reference)
(named_argument value: (identifier) @local.reference)
(binary_expression left: (identifier) @local.reference)
(binary_expression right: (identifier) @local.reference)
(unary_expression operand: (identifier) @local.reference)
(assignment_statement left: (identifier) @local.reference)
(assignment_statement right: (identifier) @local.reference)
(member_access_expression object: (identifier) @local.reference)
(invocation_expression function: (identifier) @local.reference)
(parenthesized_expression (identifier) @local.reference)
(return_statement (identifier) @local.reference)
(interpolation value: (identifier) @local.reference)
(if_statement condition: (identifier) @local.reference)
(elseif_clause condition: (identifier) @local.reference)
(single_line_if_statement condition: (identifier) @local.reference)
(while_statement condition: (identifier) @local.reference)
(do_statement condition: (identifier) @local.reference)
(select_statement value: (identifier) @local.reference)
(for_statement start: (identifier) @local.reference)
(for_statement end: (identifier) @local.reference)
(for_statement step: (identifier) @local.reference)
(for_each_statement collection: (identifier) @local.reference)
(variable_declarator value: (identifier) @local.reference)
(range_variable collection: (identifier) @local.reference)
(where_clause (identifier) @local.reference)
(select_clause (identifier) @local.reference)
