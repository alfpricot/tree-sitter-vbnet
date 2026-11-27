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
  ].toSorted((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10) || a.localeCompare(b));

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
    '        If a Then b() _', // 10
    '        Else c()', // 11
    '    End Sub', // 12
    'End Class', // 13
    '',
  ].join('\n');
  assert.deepEqual(
    at(captures('folds.scm', source), 'fold').filter((c) => c.endsWith(':else_clause')),
    ['7:else_clause'],
  );
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
    '12:End',
    '13:End',
  ]);
});

// The level an editor following `@indent.begin` and `@indent.branch` gives a
// line: one for each construct opened on an earlier line that still holds it,
// less one when the line itself closes or divides a construct.
function indentLevels(source) {
  const found = captures('indents.scm', source);
  return source.split('\n').map((line, row) => {
    const column = line.length - line.trimStart().length;
    const opened = new Set(
      found
        .filter((c) => c.name === 'indent.begin')
        .filter((c) => c.node.startPosition.row < row && c.node.endPosition.row >= row)
        .filter((c) => c.node.endPosition.row > row || c.node.endPosition.column > column)
        .map((c) => c.node.id),
    );
    const closes = found.some(
      (c) =>
        c.name === 'indent.branch' &&
        c.node.startPosition.row === row &&
        c.node.startPosition.column === column,
    );
    return opened.size - (closes ? 1 : 0);
  });
}

test('the indent query reproduces the layout of nested blocks', () => {
  const lines = [
    'Class C',
    '    Sub Run()',
    '        Select Case x',
    '            Case 1',
    '                Try',
    '                    a = 1',
    '                Catch ex As Exception',
    '                    a = 2',
    '                Finally',
    '                    a = 3',
    '                End Try',
    '            Case Else',
    '                If a Then',
    '                    b = 1',
    '                ElseIf c Then',
    '                    b = 2',
    '                Else',
    '                    b = 3',
    '                End If',
    '        End Select',
    '    End Sub',
    'End Class',
  ];
  assert.deepEqual(
    indentLevels(lines.join('\n')),
    lines.map((line) => (line.length - line.trimStart().length) / 4),
  );
});

test('the indent query indents the content of a multi-line XML element', () => {
  const lines = [
    'Module M',
    '    Sub Run()',
    '        Dim d = <root>',
    '                </root>',
    '        Dim e = <root>',
    '                </root>',
    '        a = <b>c</b>',
    '        f = <g/>',
    '    End Sub',
    'End Module',
  ];
  const found = captures('indents.scm', lines.join('\n'));
  assert.deepEqual(at(found, 'indent.begin'), [
    '0:module_block',
    '1:method_declaration',
    '2:xml_element',
    '4:xml_element',
    '6:xml_element',
  ]);
  assert.deepEqual(at(found, 'indent.branch'), ['3:</', '5:</', '6:</', '8:End', '9:End']);
  assert.deepEqual(
    at(captures('folds.scm', lines.join('\n')), 'fold').filter((c) => c.endsWith(':xml_element')),
    ['2:xml_element', '4:xml_element', '6:xml_element'],
  );
});

test('a Next closing several loops keeps the bodies indented, at the innermost loop level', () => {
  const lines = [
    'Module M',
    '    Sub Run()',
    '        For i = 0 To 1',
    '            For j = 0 To 1',
    '                For k = 0 To 1',
    '                    x = 1',
    '        Next k, j, i',
    '        y = 2',
    '    End Sub',
    'End Module',
  ];
  const written = lines.map((line) => (line.length - line.trimStart().length) / 4);
  // The shared line has every loop to close, and branch captures take back one
  // level per line, so it lands at the level of the innermost `For`.
  const expected = written.map((level, row) => (row === 6 ? level + 2 : level));
  assert.deepEqual(indentLevels(lines.join('\n')), expected);
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
