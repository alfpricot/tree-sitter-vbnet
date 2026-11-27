import assert from 'node:assert';
import { test } from 'node:test';
import Parser from 'tree-sitter';

test('can load grammar', async () => {
  const parser = new Parser();
  await assert.doesNotReject(async () => {
    const { default: language } = await import('./index.js');
    parser.setLanguage(language);
  });
});

test('exports node type metadata', async () => {
  const { default: language } = await import('./index.js');
  assert(Array.isArray(language.nodeTypeInfo));
  assert(language.nodeTypeInfo.some((node) => node.type === 'source_file'));
});

test('exports the vbnet language name', async () => {
  const { default: language } = await import('./index.js');
  assert.equal(language.name, 'vbnet');
});

test('exports a highlights query that compiles against the grammar', async () => {
  const { default: language } = await import('./index.js');
  const query = language.HIGHLIGHTS_QUERY;
  assert(query, 'No highlights query');
  assert.match(query, /@keyword/);
  assert.doesNotThrow(() => new Parser.Query(language, query));
});

test('parses a module with implicit line continuation without error', async () => {
  const { default: language } = await import('./index.js');
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(
    'Module M\n    Sub Main()\n        Dim s = "a" &\n            "b"\n    End Sub\nEnd Module\n',
  );
  assert.equal(tree.rootNode.hasError, false);
});
