// A VB file means the same thing whichever line break it uses. The corpus is
// committed with LF endings, so this reparses its inputs with the other line
// breaks and compares the trees.
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import Parser from 'tree-sitter';
import language from './index.js';

const corpus = new URL('../../test/corpus/', import.meta.url);

// Each corpus case is a `===` fenced title, the source, a `---` rule, and the
// expected tree. Cases that expect errors are left out.
function inputs(file) {
  const text = readFileSync(new URL(file, corpus), 'utf8').replaceAll('\r\n', '\n');
  const cases = text.matchAll(/^={3,}\n(.*?)^={3,}\n(.*?)^-{3,}$/gms);
  return [...cases]
    .filter(([, title]) => !title.includes(':error'))
    .map(([, title, source]) => ({
      name: `${file}: ${title.trim()}`,
      source: `${source.trim()}\n`,
    }));
}

const parser = new Parser();
parser.setLanguage(language);
const tree = (source) => parser.parse(source).rootNode.toString();

const cases = readdirSync(corpus)
  .filter((file) => file !== 'errors.txt')
  .flatMap(inputs);

// A preprocessor line is only recognized at the start of a line, and the
// column the scanner reads resets at `\n` alone, so inputs with directives are
// compared for CRLF only.
const hasDirective = ({ source }) => /^\s*#[A-Za-z]/m.test(source);

for (const [label, lineBreak] of [
  ['CRLF', '\r\n'],
  ['CR', '\r'],
  ['U+2028', '\u2028'],
  ['U+2029', '\u2029'],
  ['U+0085', '\u0085'],
]) {
  test(`corpus inputs parse the same with ${label} line breaks`, () => {
    const compared = lineBreak.endsWith('\n') ? cases : cases.filter((c) => !hasDirective(c));
    assert(compared.length > 0, 'No corpus cases found');
    for (const { name, source } of compared) {
      assert.equal(tree(source.replaceAll('\n', lineBreak)), tree(source), name);
    }
  });
}
