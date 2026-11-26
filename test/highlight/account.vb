Public Class Account
'^ keyword
'      ^ keyword
'            ^ type
    Inherits BaseAccount
'   ^ keyword
    Private balance As Decimal = 0D
'   ^ keyword
'                   ^ keyword
'                      ^ type.builtin
'                                ^ number.float
    Public Function Deposit(amount As Decimal) As Boolean
'          ^ keyword
'                   ^ function.method
'                           ^ variable.parameter
        If amount <= 0 Then Return False
'       ^ keyword
'                 ^ operator
'                    ^ number
'                      ^ keyword
'                           ^ keyword
'                                  ^ boolean
        Dim note = $"Deposit {amount:C}" ' audit
'       ^ keyword
'                  ^ string
'                                        ^ comment
        Me.balance += CDec(amount)
'       ^ variable.builtin
'          ^ property
'                  ^ operator
'                     ^ function.builtin
        Log(Nothing, "x"c, #1/2/2020#)
'       ^ function.call
'           ^ constant.builtin
'                    ^ character
'                          ^ string.special
        Return x IsNot Nothing AndAlso Not done
'                ^ keyword.operator
'                              ^ keyword.operator
'                                      ^ keyword.operator
    End Function
'   ^ keyword
'       ^ keyword
#Region "Helpers"
'^ keyword.directive
#End Region
End Class
