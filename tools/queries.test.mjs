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

// The `(node "Keyword")` and `(node)` entries of every bracketed list that
// carries one of the captures, comments left out.
function listed(file, capture) {
  const query = read(file).replace(/;.*$/gm, '');
  const lists = [...query.matchAll(/\[([^\]]*)\]\s*@([\w.]+)/g)].filter(([, , name]) =>
    capture.test(name),
  );
  return lists.flatMap(([, body]) => body.match(/\(\w+(?: "\w+")?\)/g) ?? []).toSorted();
}

test('folds cover every construct that indents and every dividing clause', () => {
  // `indent.branch` lists the clauses that divide a construct.
  const indented = listed('queries/indents.scm', /^indent\.(?:begin|branch)$/);
  assert(indented.length > 0, 'The indent query lists nothing');
  assert.deepEqual(listed('queries/folds.scm', /^fold$/), indented);
});

test('folds capture the inactive branch of an #If', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'vbnet-folds-'));
  try {
    const file = join(scratch, 'folds.vb');
    writeFileSync(file, '#If A Then\n#Else\nImports B\nImports C\n#End If\n');
    const output = execFileSync(
      resolveTreeSitterCli(repo),
      ['query', '-p', repo, 'queries/folds.scm', file],
      { cwd: repo, encoding: 'utf8' },
    );
    assert.match(output, /capture: (\d+ - )?fold, start: \(2, 0\), end: \(3, 9\)/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

// Each use of `x` below sits in a value position the locals query has to mark.
test('locals marks a reference in each value position', () => {
  const uses = [
    'Throw x',
    'Await x',
    'y = If(x, x, x)',
    'y = CType(x, Integer)',
    'With x\n    End With',
    'Select Case x\n    Case x\n    End Select',
    'x',
  ];
  const scratch = mkdtempSync(join(tmpdir(), 'vbnet-locals-'));
  try {
    const file = join(scratch, 'locals.vb');
    const body = uses.map((use) => `    ${use}`).join('\n');
    writeFileSync(file, `Module M\n  Sub S(x As Object)\n${body}\n  End Sub\nEnd Module\n`);
    const output = execFileSync(
      resolveTreeSitterCli(repo),
      ['query', '-p', repo, 'queries/locals.scm', file],
      { cwd: repo, encoding: 'utf8' },
    );
    const marked = output.match(/local\.reference,.*text: `x`/g) ?? [];
    assert.equal(marked.length, uses.join('\n').match(/\bx\b/g)?.length, output);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('pyproject.toml carries the release version', () => {
  const project = read('pyproject.toml')
    .split(/^\[project\]\s*$/m)[1]
    ?.split(/^\[/m)[0];
  assert.equal(project?.match(/^version = "([^"]+)"$/m)?.[1], cargoVersion(read('Cargo.toml')));
});
