; Folding: every construct that closes with its own line, and the clauses that
; divide one.

[
  (accessor_declaration "End")
  (class_block "End")
  (constructor_declaration "End")
  (custom_event_declaration "End")
  (enum_block "End")
  (event_accessor_declaration "End")
  (if_statement "End")
  (interface_block "End")
  (lambda_expression "End")
  (method_declaration "End")
  (module_block "End")
  (namespace_block "End")
  (operator_declaration "End")
  (property_declaration "End")
  (select_statement "End")
  (structure_block "End")
  (sync_lock_statement "End")
  (try_statement "End")
  (using_statement "End")
  (while_statement "End")
  (with_statement "End")
  (do_statement "Loop")
  (for_each_statement)
  (for_statement)
  (case_branch_clause)
  (case_else_clause)
  (catch_clause)
  (elseif_clause)
  (finally_clause)
] @fold

; A single-line `If` holds an `else_clause` too, which divides no block.
(if_statement (else_clause) @fold)
