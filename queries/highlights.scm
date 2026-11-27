; Comments and preprocessor lines

(comment) @comment

(preprocessor_directive) @keyword.directive

; Literals

(string_literal) @string
(character_literal) @character
(interpolated_string_expression) @string
(interpolation_format) @string.special
(date_literal) @string.special
(integer_literal) @number
(floating_literal) @number.float
(boolean_literal) @boolean
(nothing) @constant.builtin

; Built-in names

[
  (me)
  (my_base)
  (my_class)
  (global)
] @variable.builtin

(primitive_type) @type.builtin

; Declarations

(class_block name: (identifier) @type)
(module_block name: (identifier) @type)
(structure_block name: (identifier) @type)
(interface_block name: (identifier) @type)
(enum_block name: (identifier) @type)
(delegate_declaration name: (identifier) @type)
(type_parameter name: (identifier) @type)
(generic_name name: (identifier) @type)
(qualified_name name: (identifier) @type)
(enum_member name: (identifier) @constant)

(method_declaration name: (identifier) @function.method)
(method_signature name: (identifier) @function.method)
(declare_declaration name: (identifier) @function)
(constructor_declaration name: _ @constructor)
(property_declaration name: (identifier) @property)
(property_signature name: (identifier) @property)
(event_declaration name: (identifier) @property)
(custom_event_declaration name: (identifier) @property)
(parameter name: (identifier) @variable.parameter)
(attribute name: (identifier) @attribute)
(attribute name: (qualified_name name: (identifier) @attribute))
(label_statement label: (identifier) @label)
(goto_statement label: (identifier) @label)

; Calls and members

(invocation_expression function: (identifier) @function.call)
(invocation_expression
  function: (member_access_expression member: (identifier) @function.method.call))
(member_access_expression member: (identifier) @property)
(named_argument name: (identifier) @variable.parameter)

; Operators and keywords

[
  "!" "&" "&=" "*" "*=" "+" "+=" "-" "-="
  "/" "/=" ":=" "<" "<<" "<<=" "<=" "<>" "="
  ">" ">=" ">>" ">>=" "\\" "\\=" "^" "^=" "?."
] @operator

[
  "AddressOf" "And" "AndAlso" "Is" "IsNot" "Like"
  "Mod" "Not" "Or" "OrElse" "TypeOf" "Xor"
] @keyword.operator

[
  "CBool" "CByte" "CChar" "CDate" "CDbl" "CDec"
  "CInt" "CLng" "CObj" "CSByte" "CShort" "CSng"
  "CStr" "CType" "CUInt" "CULng" "CUShort" "DirectCast"
  "GetType" "NameOf" "TryCast"
] @function.builtin

[
  "AddHandler" "Aggregate" "Alias" "Ansi" "As" "Ascending"
  "Assembly" "Async" "Auto" "Await" "Binary" "By"
  "ByRef" "ByVal" "Call" "Case" "Catch" "Class"
  "Compare" "Const" "Continue" "Custom" "Declare" "Default"
  "Delegate" "Descending" "Dim" "Distinct" "Do" "Each"
  "Else" "ElseIf" "End" "Enum" "Equals" "Erase"
  "Error" "Event" "Exit" "Explicit" "Finally" "For"
  "Friend" "From" "Function" "Get" "GoTo" "Group"
  "Handles" "If" "Implements" "Imports" "In" "Infer"
  "Inherits" "Interface" "Into" "IsFalse" "IsTrue" "Iterator"
  "Join" "Key" "Let" "Lib" "Loop" "Module"
  "MustInherit" "MustOverride" "Namespace" "Narrowing" "New" "Next"
  "NotInheritable" "NotOverridable" "Of" "Off" "On" "Operator" "Option"
  "Optional" "Order" "Out" "Overloads" "Overridable" "Overrides"
  "ParamArray" "Partial" "Preserve" "Private" "Property" "Protected"
  "Public" "RaiseEvent" "ReDim" "ReadOnly" "RemoveHandler" "Resume"
  "Return" "Select" "Set" "Shadows" "Shared" "Skip"
  "Static" "Step" "Stop" "Strict" "Structure" "Sub"
  "SyncLock" "Take" "Text" "Then" "Throw" "To"
  "Try" "Unicode" "Until" "Using" "When" "Where"
  "While" "Widening" "With" "WithEvents" "WriteOnly" "Yield"
] @keyword

[
  "("
  ")"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  "."
  ":"
] @punctuation.delimiter

; The angle brackets of an attribute block are not comparisons

(attribute_list ["<" ">"] @punctuation.bracket)
(attribute_statement ["<" ">"] @punctuation.bracket)

; XML literals and axis properties

(xml_element name: (xml_name) @tag)
(xml_element end_name: (xml_name) @tag)
(xml_attribute name: (xml_name) @tag.attribute)
(xml_attribute_value) @string
(xml_comment) @comment
(xml_cdata) @string.special
(xml_processing_instruction) @keyword.directive
(xml_axis_expression name: (xml_name) @tag)
(xml_element ["<" ">" "</" "/>"] @tag.delimiter)
(xml_axis_expression ["<" ">"] @tag.delimiter)
(xml_axis_expression [".@" "..."] @punctuation.delimiter)
(xml_embedded_expression ["<%=" "%>"] @punctuation.special)
