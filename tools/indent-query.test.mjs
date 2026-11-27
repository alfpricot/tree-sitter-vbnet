// Every construct the grammar closes with an `End` line has to appear in the
// indent query; a new one that is left out would silently not indent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const { rules } = JSON.parse(readFileSync(join(repo, 'src/grammar.json'), 'utf8'));
const query = readFileSync(join(repo, 'queries/indents.scm'), 'utf8');

function closesWithEnd(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'ALIAS' && node.content?.name === '_block_end') return true;
  return Object.values(node).some(closesWithEnd);
}

const blocks = Object.keys(rules)
  .filter((name) => closesWithEnd(rules[name]))
  .sort();

for (const [role, pattern] of [
  ['begins an indent', /^ {2}\((\w+) "End"\)$/gm],
  ['outdents its End line', /^\((\w+) "End" @indent\.branch\)$/gm],
]) {
  test(`every construct closed by an End line ${role}`, () => {
    const named = [...query.matchAll(pattern)].map((m) => m[1]).sort();
    assert.deepEqual(named, blocks);
  });
}
