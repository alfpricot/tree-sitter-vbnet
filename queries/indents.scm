; Indentation. A construct that closes with its own line indents everything
; after its first line, so the closing keyword is what identifies it: a
; single-line `If`, a single-line lambda, or an auto-implemented property has
; none. `For` loops are captured whole, because the outer of two loops closed
; by one `Next j, i` has no `Next` of its own.
;
; Known limit: that shared line has to close both loops, and a branch capture
; takes back only one level per line, so it lands one level deeper than the
; outer `For`.

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
] @indent.begin

; A `Case` line sits one level inside its `Select`, and its statements one
; level inside that.

[
  (case_block)
  (case_else_block)
] @indent.begin

; Closing lines return to the level of the opening line. `End` is captured per
; construct so that a bare `End` statement is left alone.

(accessor_declaration "End" @indent.branch)
(class_block "End" @indent.branch)
(constructor_declaration "End" @indent.branch)
(custom_event_declaration "End" @indent.branch)
(enum_block "End" @indent.branch)
(event_accessor_declaration "End" @indent.branch)
(if_statement "End" @indent.branch)
(interface_block "End" @indent.branch)
(lambda_expression "End" @indent.branch)
(method_declaration "End" @indent.branch)
(module_block "End" @indent.branch)
(namespace_block "End" @indent.branch)
(operator_declaration "End" @indent.branch)
(property_declaration "End" @indent.branch)
(select_statement "End" @indent.branch)
(structure_block "End" @indent.branch)
(sync_lock_statement "End" @indent.branch)
(try_statement "End" @indent.branch)
(using_statement "End" @indent.branch)
(while_statement "End" @indent.branch)
(with_statement "End" @indent.branch)
(do_statement "Loop" @indent.branch)
(for_each_statement "Next" @indent.branch)
(for_statement "Next" @indent.branch)

; Lines that divide a construct sit at its level.

[
  (catch_block)
  (else_clause)
  (elseif_clause)
  (finally_block)
] @indent.branch
