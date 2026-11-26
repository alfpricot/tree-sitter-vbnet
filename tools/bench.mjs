#!/usr/bin/env node
// Parse-throughput benchmark for the external scanner and the generated
// parser. Runs each corpus through the Node binding a number of times and
// reports the time per parse and the throughput, so a grammar or scanner
// change can be compared before and after:
//
//   node tools/bench.mjs            # default: 200 iterations per corpus
//   node tools/bench.mjs 1000       # more iterations, steadier numbers
//
// The corpora cover the scanner's different paths: statement-ending line
// breaks, implicit line continuation (line breaks the scanner declines),
// comment and blank lines, preprocessor lines, `(Of` lookahead, interpolated
// strings, query continuation lookahead, error recovery, and the test
// fixtures as they are. Run it twice per revision and compare; differences
// below ~1% are noise on a busy machine.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'tree-sitter';
import language from '../bindings/node/index.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const fixtureDir = join(repo, 'test/fixtures');
const fixtures = readdirSync(fixtureDir)
  .filter((f) => f.endsWith('.vb'))
  .map((f) => readFileSync(join(fixtureDir, f), 'utf8'));

const repeat = (text, times) => text.repeat(times);
const module = (body) => `Module M\n    Sub Run()\n${body}    End Sub\nEnd Module\n`;

const corpora = [
  ['fixtures', fixtures.join('\n')],
  [
    'statements',
    module(repeat('        Dim total As Integer = a + b * c\n        total += 1\n', 600)),
  ],
  [
    'continuation',
    module(
      repeat('        Call(Compute(a,\n            b,\n            c) &\n            "x")\n', 400),
    ),
  ],
  ['comments', module(repeat("        ' a comment line\n\n        x = 1 ' trailing\n", 500))],
  [
    'directives',
    module(repeat('#Region "r"\n#If DEBUG Then\n        x = 1\n#End If\n#End Region\n', 300)),
  ],
  [
    'generics',
    module(
      repeat('        Dim d As New Dictionary(Of String, List(Of Integer))(Compute(x))\n', 500),
    ),
  ],
  [
    'interpolation',
    module(repeat('        s = $"Name: {name,-10} Total: {total:N2} {{x}}"\n', 500)),
  ],
  [
    'queries',
    module(
      repeat(
        '        Dim q = From c In customers\n                Where c.Total > 10\n                Order By c.Name\n                Select c.Name\n',
        200,
      ),
    ),
  ],
  ['error-recovery', module(repeat('        Dim = = 1\n        If Then\n        x = (1\n', 200))],
];

const iterations = Number(process.argv[2] ?? 200);
const parser = new Parser();
parser.setLanguage(language);

for (const [name, source] of corpora) {
  for (let i = 0; i < 10; i++) parser.parse(source); // warm-up
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) parser.parse(source);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  const parsed = (source.length * iterations) / 1024 / 1024;
  const mbPerS = (parsed / (ms / 1000)).toFixed(1);
  console.log(
    `${name.padEnd(14)} ${(ms / iterations).toFixed(3).padStart(8)} ms/parse  ${mbPerS.padStart(6)} MB/s`,
  );
}
