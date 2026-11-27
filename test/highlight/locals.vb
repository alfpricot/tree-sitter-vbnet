Class Counter
    Public Event Changed(Format As Integer)
    Delegate Sub Notify(Describe As Integer)
    Sub Add(items As Integer())
        Log(Format(1), Describe(2), items(0))
'           ^ function.call
'                      ^ function.call
'                                   ^ variable.parameter
    End Sub
End Class
