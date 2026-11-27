#!/usr/bin/env node
// Node-kind snapshot: prints the sorted list of named node kinds the
// grammar exports (from src/node-types.json), each followed by its field
// names as `kind.field` — the public API consumers key on. The listing is
// committed in test/node-kinds.txt; CI regenerates the parser, re-extracts,
// and diffs, so a rename cannot land quietly (a rename or removal is a major
// version bump).
//
//   node tools/node-kinds.mjs            # print the listing
//   node tools/node-kinds.mjs --check    # diff against test/node-kinds.txt
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function snapshotLines(types) {
  return types
    .filter((n) => n.named)
    .flatMap((n) => [n.type, ...Object.keys(n.fields ?? {}).map((field) => `${n.type}.${field}`)])
    .sort();
}

function main() {
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const types = JSON.parse(readFileSync(join(repo, 'src/node-types.json'), 'utf8'));
  const lines = snapshotLines(types);
  if (!process.argv.includes('--check')) {
    for (const line of lines) console.log(line);
    return;
  }
  const committed = readFileSync(join(repo, 'test/node-kinds.txt'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'));
  const added = lines.filter((k) => !committed.includes(k));
  const removed = committed.filter((k) => !lines.includes(k));
  if (added.length || removed.length) {
    console.error('node-kind snapshot drift:');
    added.forEach((k) => console.error(`  + ${k}`));
    removed.forEach((k) => console.error(`  - ${k}`));
    console.error('(a removal or rename is a major version bump)');
    process.exit(1);
  }
  console.log(`node-kind snapshot matches (${lines.length} kinds and fields)`);
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  main();
}
