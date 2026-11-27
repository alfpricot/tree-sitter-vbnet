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
  (property_signature)
  (delegate_declaration)
  (declare_declaration)
  (event_declaration)
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

; A loop variable with its own `As` type is declared by the loop. Without one
; the loop reuses a variable in scope or, under `Option Infer On`, declares
; one, which a query cannot tell apart, so it is not marked.
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
(ternary_expression (identifier) @local.reference)
(coalesce_expression (identifier) @local.reference)
(await_expression (identifier) @local.reference)
(cast_expression value: (identifier) @local.reference)
(conversion_expression value: (identifier) @local.reference)
(type_of_expression value: (identifier) @local.reference)
(name_of_expression value: (identifier) @local.reference)
(tuple_expression (identifier) @local.reference)
(collection_initializer (identifier) @local.reference)
(field_initializer value: (identifier) @local.reference)
(dictionary_access_expression object: (identifier) @local.reference)
(lambda_expression body: (identifier) @local.reference)
(range_argument low: (identifier) @local.reference)
(range_argument high: (identifier) @local.reference)
(parameter default: (identifier) @local.reference)
(property_declaration value: (identifier) @local.reference)
(interpolation alignment: (identifier) @local.reference)
(expression_statement (identifier) @local.reference)
(call_statement (identifier) @local.reference)
(throw_statement (identifier) @local.reference)
(yield_statement (identifier) @local.reference)
(erase_statement (identifier) @local.reference)
(redim_statement (identifier) @local.reference)
(add_handler_statement (identifier) @local.reference)
(remove_handler_statement (identifier) @local.reference)
(with_statement object: (identifier) @local.reference)
(using_statement resource: (identifier) @local.reference)
(sync_lock_statement lock: (identifier) @local.reference)
(case_clause value: (identifier) @local.reference)
(case_clause low: (identifier) @local.reference)
(case_clause high: (identifier) @local.reference)
(catch_block filter: (identifier) @local.reference)
(let_clause value: (identifier) @local.reference)
(ordering (identifier) @local.reference)
(group_by_clause items: (identifier) @local.reference)
(group_by_clause keys: (identifier) @local.reference)
(join_condition left: (identifier) @local.reference)
(join_condition right: (identifier) @local.reference)
(partition_clause (identifier) @local.reference)
(aggregation value: (identifier) @local.reference)
