// The external scanner repeats two keyword lists the grammar defines: the
// words that close a block after `End`, and the words that continue a query on
// the next line. A keyword added to one side only would parse wrongly without
// failing any corpus case, so this compares them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const { rules } = JSON.parse(readFileSync(join(repo, 'src/grammar.json'), 'utf8'));
const scanner = readFileSync(join(repo, 'src/scanner.c'), 'utf8');

function scannerList(name) {
  const body = scanner.match(new RegExp(`${name}\\[\\] = \\{([^}]*)\\}`));
  assert(body, `array ${name} not found in src/scanner.c`);
  return [...body[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
}

const keyword = (node) => node?.type === 'ALIAS' && !node.named && node.value.toLowerCase();

// Every keyword that can follow one of the scanner's `End` tokens.
function closers(token, node, found = new Set()) {
  if (!node || typeof node !== 'object') return found;
  if (node.type === 'SEQ' && node.members[0]?.content?.name === token) {
    for (const member of node.members[1].members) found.add(keyword(member));
  }
  Object.values(node).forEach((child) => closers(token, child, found));
  return found;
}

// The keywords a rule can start with.
function leading(node) {
  if (keyword(node)) return [keyword(node)];
  if (node.type === 'SYMBOL') return leading(rules[node.name]);
  if (node.type === 'SEQ') return leading(node.members[0]);
  if (node.type === 'CHOICE') return node.members.flatMap(leading);
  assert(node.content, `no leading keyword in a ${node.type} node`);
  return leading(node.content);
}

const sorted = (words) => [...new Set(words)].toSorted();

test('the scanner closes blocks on the keywords the grammar ends them with', () => {
  assert.deepEqual(sorted(scannerList('block_closers')), sorted(closers('_block_end', rules)));
});

test('the scanner closes members on the keywords the grammar ends them with', () => {
  assert.deepEqual(sorted(scannerList('member_closers')), sorted(closers('_member_end', rules)));
});

test('the scanner continues a query on every keyword that starts a later clause', () => {
  const expected = [...leading(rules['_query_clause']), ...leading(rules.into_clause)];
  // `Select` is handled on its own, to tell it from `Select Case`.
  assert.deepEqual(sorted([...scannerList('operators'), 'select']), sorted(expected));
  assert.match(scanner, /word_is\(word, "select"\)/);
});
