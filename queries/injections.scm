; String literals have no node for the text between the quotes, so each
; injected range includes them.

; The pattern of `New Regex(...)` is its first argument.

((object_creation_expression
  type: [
    (identifier) @_type
    (qualified_name name: (identifier) @_type)
  ]
  arguments: (argument_list . (string_literal) @injection.content))
  (#match? @_type "^[Rr][Ee][Gg][Ee][Xx]$")
  (#set! injection.language "regex"))

; The pattern of `Regex.IsMatch(input, ...)` is its second argument.

((invocation_expression
  function: (member_access_expression
    object: [
      (identifier) @_type
      (member_access_expression member: (identifier) @_type)
    ]
    member: (identifier) @_method)
  arguments: (argument_list . (_) . "," . (string_literal) @injection.content))
  (#match? @_type "^[Rr][Ee][Gg][Ee][Xx]$")
  (#match? @_method "^[Ii][Ss][Mm][Aa][Tt][Cc][Hh]$")
  (#set! injection.language "regex"))
