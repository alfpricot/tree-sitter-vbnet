// The queries editors load, run against a sample: each compiles against the
// grammar and captures the nodes it is meant to.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import Parser from 'tree-sitter';
import language from './index.js';

const parser = new Parser();
parser.setLanguage(language);

function captures(file, source) {
  const text = readFileSync(new URL(`../../queries/${file}`, import.meta.url), 'utf8');
  return new Parser.Query(language, text).captures(parser.parse(source).rootNode);
}

// The captures of one name, as `row:node type`.
const at = (found, name) =>
  [
    ...new Set(
      found.filter((c) => c.name === name).map((c) => `${c.node.startPosition.row}:${c.node.type}`),
    ),
  ].sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10) || a.localeCompare(b));

test('the indent query opens and closes blocks but not single-line forms', () => {
  const source = [
    'Class C', // 0
    '    Property Name As String', // 1
    '    Sub Run()', // 2
    '        If a Then b = 1', // 3
    '        For i = 0 To 1', // 4
    '            If a Then', // 5
    '                End', // 6
    '            Else', // 7
    '            End If', // 8
    '        Next', // 9
    '    End Sub', // 10
    'End Class', // 11
    '',
  ].join('\n');
  const found = captures('indents.scm', source);
  assert.deepEqual(at(found, 'indent.begin'), [
    '0:class_block',
    '2:method_declaration',
    '4:for_statement',
    '5:if_statement',
  ]);
  assert.deepEqual(at(found, 'indent.branch'), [
    '7:else_clause',
    '8:End',
    '9:Next',
    '10:End',
    '11:End',
  ]);
});

test('the injection query marks regular-expression patterns', () => {
  const source = [
    'Module M',
    '    Sub Run()',
    '        a = New Regex("^a$")',
    '        b = New System.Text.RegularExpressions.Regex("^b$", options)',
    '        c = Regex.IsMatch("input", "^c$")',
    '        d = regex.isMatch(text, "^d$", options)',
    '        e = New Other("not")',
    '        f = Regex.Replace(text, "not", "")',
    '    End Sub',
    'End Module',
    '',
  ].join('\n');
  const patterns = captures('injections.scm', source)
    .filter((c) => c.name === 'injection.content')
    .map((c) => c.node.text);
  assert.deepEqual(patterns, ['"^a$"', '"^b$"', '"^c$"', '"^d$"']);
});
