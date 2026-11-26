# Test fixtures

Whole VB.NET files, parsed by `tools/fixture-check.mjs` on every change (zero `ERROR`/`MISSING` nodes and zero zero-width nodes required). The corpus tests in `test/corpus/` assert exact tree shapes; these files assert that real code parses end to end.

Each fixture is an unmodified copy of a public, MIT-licensed sample from Microsoft's [dotnet/samples](https://github.com/dotnet/samples) (at commit `3810558800760fc39282cc939bac645735514209`) or [dotnet/docs](https://github.com/dotnet/docs) (at commit `7460ede22123a70603267df744ddb66aaca69f5e`) repository, copyright (c) Microsoft Corporation, licensed under the MIT License in each repository's `LICENSE-CODE` file. See [NOTICE](../../NOTICE).

| Fixture | Source | Constructs |
| --- | --- | --- |
| `winforms-form.vb` | dotnet/samples `windowsforms/formatting-utility/vb/Form1.vb` | `Handles` clauses on event handlers, multi-line `If`, `Try`/`Catch`, string formatting |
| `winforms-designer.vb` | dotnet/samples `windowsforms/formatting-utility/vb/Form1.Designer.vb` | designer-generated code: attributes on their own line, `Partial Class`, `Inherits` on its own line, `WithEvents` fields, `Me.` member assignments |
| `async-await.vb` | dotnet/samples `async/async-and-await/vb/ParallelAsyncExample/MainWindow.xaml.vb` | `Async`/`Await`, `Task(Of T)`, `Task.WhenAll`, lambdas |
| `game-of-life.vb` | dotnet/samples `windowsforms/Conway's-Game-of-Life/VB/Conway's-Game-of-Life/Program/core/Animation.vb` | a jagged array field (`(99)()`), nested `For` loops, `Do ... Loop`, `Select Case` |
| `linq-queries.vb` | dotnet/docs `samples/snippets/visualbasic/VS_Snippets_VBCSharp/VbLINQWalkthrough/VB/Class1.vb` | LINQ queries split across lines, `Where`, `Order By`, `Into` with aggregates |
| `custom-events.vb` | dotnet/docs `docs/standard/events/snippets/how-to-handle-multiple-events-using-event-properties/vb/Sensor.vb` | `Custom Event` with `AddHandler`/`RemoveHandler`/`RaiseEvent` accessors, a shared `EventHandlerList` |
| `operators.vb` | dotnet/docs `samples/snippets/visualbasic/VS_Snippets_VBCSharp/VbVbalrStatements/VB/class7.vb` | operator overloading, including a `CType` conversion operator |
| `error-handling.vb` | dotnet/docs `samples/snippets/visualbasic/VS_Snippets_VBCSharp/VbVbalrErrorHandling/VB/Class1.vb` | `On Error GoTo`, `Resume Next`, labels, `Err` object use, `Try`/`Catch`, `Exit Sub` |

## Commands

```bash
node tools/fixture-check.mjs   # parse every fixture; fail on ERROR/MISSING/zero-width
```
