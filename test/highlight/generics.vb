<Assembly: CLSCompliant(True)>
'^ keyword
' <- punctuation.bracket

<Serializable>
' <- punctuation.bracket
'^ attribute
'            ^ punctuation.bracket
Public Class Box(Of T)
'               ^ punctuation.bracket
'                ^ keyword
'                   ^ type
    Private items As New List(Of T)()
'                            ^ punctuation.bracket
'                             ^ keyword

    <Obsolete> Public Function Smaller(a As Integer) As Boolean
'   ^ punctuation.bracket
'            ^ punctuation.bracket
        Return a < 1
'                ^ operator
    End Function
End Class
