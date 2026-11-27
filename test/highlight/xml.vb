Imports <xmlns:ns="urn:sample">
'       ^ tag.delimiter
'        ^ tag.attribute
'                 ^ string
Module M
    Sub Run(items As String())
        Dim doc = <list kind="names"><%= items.Length %></list>
'                 ^ tag.delimiter
'                  ^ tag
'                       ^ tag.attribute
'                            ^ string
'                                    ^ punctuation.special
'                                                         ^ tag
        Dim whole = <?xml version="1.0"?><list/>
'                   ^ keyword.directive
        Dim first = doc.<item>.@name
'                       ^ tag.delimiter
'                        ^ tag
'                              ^ punctuation.delimiter
'                                ^ tag.attribute
    End Sub
End Module
