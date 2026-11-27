// The navigation queries against a whole fixture file, and the checks that a
// new construct or version file is not left out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTreeSitterCli } from './fixture-result.mjs';
import { cargoVersion } from './release-policy.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(repo, path), 'utf8');
const fixture = 'test/fixtures/winforms-form.vb';

// `tree-sitter tags` finds grammars only through a configuration file that
// lists directories holding `tree-sitter-*` checkouts, so one is built around
// a link to this checkout, whatever its directory is called.
function runTags(file) {
  const scratch = mkdtempSync(join(tmpdir(), 'vbnet-tags-'));
  try {
    symlinkSync(repo, join(scratch, 'tree-sitter-vbnet'), 'junction');
    const config = join(scratch, 'config.json');
    writeFileSync(config, JSON.stringify({ 'parser-directories': [scratch] }));
    return execFileSync(resolveTreeSitterCli(repo), ['tags', '--config-path', config, file], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, TREE_SITTER_LIBDIR: join(scratch, 'lib') },
    });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

test('tags lists every type and member of a fixture', () => {
  const output = runTags(fixture);
  const tagged = new Set(
    [...output.matchAll(/^\s*(\S+)\s*\|\s*(\w+)\s+def /gm)].map(
      ([, name, kind]) => `${kind} ${name}`,
    ),
  );
  const lines = read(fixture).split(/\r?\n/);
  const declared = (pattern, kind) =>
    lines.flatMap((line) => {
      const match = line.match(pattern);
      return match ? [`${kind} ${match[1]}`] : [];
    });
  const expected = [
    ...declared(/^(?:Public |Partial )*Class (\w+)/, 'class'),
    ...declared(/^\s+(?:(?:Public|Private|Friend|Shared) )*(?:Sub|Function) (\w+)\(/, 'method'),
    ...declared(/^\s+(?:(?:Private|ReadOnly) )+(_\w+)(?:\(\))? As /, 'field'),
  ];
  assert(expected.length > 10, 'The fixture lost its declarations');
  for (const entry of expected) {
    assert(tagged.has(entry), `tags is missing ${entry}`);
  }
});

test('every construct that indents also folds', () => {
  const indented = read('queries/indents.scm').split('] @indent.begin')[0];
  const folds = read('queries/folds.scm');
  for (const [pattern] of indented.matchAll(/\(\w+ "\w+"\)/g)) {
    assert(folds.includes(pattern), `folds.scm is missing ${pattern}`);
  }
});

test('pyproject.toml carries the release version', () => {
  const project = read('pyproject.toml')
    .split(/^\[project\]\s*$/m)[1]
    ?.split(/^\[/m)[0];
  assert.equal(project?.match(/^version = "([^"]+)"$/m)?.[1], cargoVersion(read('Cargo.toml')));
});
