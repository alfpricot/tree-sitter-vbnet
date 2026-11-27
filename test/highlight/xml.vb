Module M
    Sub Run(items As String())
        Dim doc = <list kind="names"><%= items.Length %></list>
'                 ^ tag.delimiter
'                  ^ tag
'                       ^ tag.attribute
'                            ^ string
'                                    ^ punctuation.special
'                                                         ^ tag
        Dim first = doc.<item>.@name
'                       ^ tag.delimiter
'                        ^ tag
'                              ^ punctuation.delimiter
'                                ^ tag
    End Sub
End Module
