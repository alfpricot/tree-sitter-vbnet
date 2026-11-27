; Symbols for code navigation: every namespace, type, and type member, plus
; calls and object creation as references.

(namespace_block name: (_) @name) @definition.module
(module_block name: (identifier) @name) @definition.module

(class_block name: (identifier) @name) @definition.class
(structure_block name: (identifier) @name) @definition.class
(interface_block name: (identifier) @name) @definition.interface
(enum_block name: (identifier) @name) @definition.type
(delegate_declaration name: (identifier) @name) @definition.type

(method_declaration name: (identifier) @name) @definition.method
(method_signature name: (identifier) @name) @definition.method
(constructor_declaration name: _ @name) @definition.method
(operator_declaration operator: _ @name) @definition.method
(declare_declaration name: (identifier) @name) @definition.function

(property_declaration name: (identifier) @name) @definition.property
(property_signature name: (identifier) @name) @definition.property
(event_declaration name: (identifier) @name) @definition.event
(custom_event_declaration name: (identifier) @name) @definition.event
(field_declaration
  declarator: (variable_declarator name: (identifier) @name) @definition.field)
(enum_member name: (identifier) @name) @definition.constant

(invocation_expression function: (identifier) @name) @reference.call
(invocation_expression
  function: (member_access_expression member: (identifier) @name)) @reference.call
(object_creation_expression type: (identifier) @name) @reference.class
(object_creation_expression
  type: (generic_name name: (identifier) @name)) @reference.class
(object_creation_expression
  type: (qualified_name name: (identifier) @name)) @reference.class
