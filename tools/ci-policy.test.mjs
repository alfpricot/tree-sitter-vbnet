import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  canSkipEditedBuild,
  changedPaths,
  docsOnly,
  needsWindowsBinding,
  plan,
  runCommand,
  verifyResults,
} from './ci-policy.mjs';

const pullRequest = (action, changes = {}) => ({
  action,
  changes,
  pull_request: { base: { sha: 'base' }, head: { sha: 'head' } },
});

test('only explicit prose and metadata paths skip builds', () => {
  assert(docsOnly(['README.md', 'docs/guide.md']));
  assert(docsOnly(['NOTICE', '.github/CODEOWNERS', '.github/dependabot.yml']));
  for (const files of [
    [],
    ['grammar.js'],
    ['README.md', 'package.json'],
    ['test/fixtures/README.md'],
    ['test/corpus/errors.txt'],
    ['.github/workflows/verify.yml'],
    ['LICENSE'],
    ['.editorconfig'],
    ['.gitattributes'],
  ]) {
    assert(!docsOnly(files), files.join(', '));
  }
});

test('the Windows binding job runs for changes it can see differently', () => {
  for (const path of [
    'bindings/node/index.js',
    'bindings/node/binding.cc',
    'binding.gyp',
    'package.json',
    'package-lock.json',
    'src/scanner.c',
    'src/tree_sitter/alloc.h',
    '.gitattributes',
    '.nvmrc',
    '.github/workflows/verify.yml',
  ]) {
    assert(needsWindowsBinding([path]), path);
  }
  assert(!needsWindowsBinding(['README.md', 'grammar.js', 'src/parser.c', 'bindings/rust/lib.rs']));
});

test('renames include the removed source path when classifying prose', () => {
  const files = changedPaths('base', 'head', (command, args) => {
    assert.equal(command, 'git');
    assert.deepEqual(args, ['diff', '--no-renames', '--name-only', '-z', 'base...head']);
    return 'docs/grammar.md\0grammar.js\0';
  });
  assert.deepEqual(files, ['docs/grammar.md', 'grammar.js']);
  assert(!docsOnly(files));
});

test('only an edit of an already verified head skips the build', () => {
  assert(canSkipEditedBuild(pullRequest('edited'), true));
  assert(!canSkipEditedBuild(pullRequest('edited'), false));
  assert(!canSkipEditedBuild(pullRequest('edited', { base: { ref: {} } }), true));
  assert(!canSkipEditedBuild(pullRequest('synchronize'), true));
});

const prose = () => ['README.md'];
const grammar = () => ['grammar.js'];

test('the plan narrows pull requests only', () => {
  assert.deepEqual(plan('push', {}, false, prose), { build: true, windows: true });
  assert.deepEqual(plan('workflow_dispatch', {}, false, prose), { build: true, windows: true });
  assert.deepEqual(plan('pull_request', pullRequest('edited', { base: {} }), true, prose), {
    build: true,
    windows: true,
  });
  assert.deepEqual(plan('pull_request', pullRequest('opened'), false, prose), {
    build: false,
    windows: false,
  });
  assert.deepEqual(plan('pull_request', pullRequest('opened'), false, grammar), {
    build: true,
    windows: false,
  });
  assert.deepEqual(plan('pull_request', pullRequest('edited'), false, grammar), {
    build: true,
    windows: false,
  });
  assert.deepEqual(plan('pull_request', pullRequest('edited'), true, grammar), {
    build: false,
    windows: false,
  });
});

function results(build, eventName) {
  return Object.fromEntries(
    ['changes', 'verify', 'node-binding', 'secret-scanning', 'pr-title', 'workflow-meta'].map(
      (job) => {
        const skipped =
          (job === 'pr-title' && eventName !== 'pull_request') ||
          (['verify', 'node-binding'].includes(job) && build === 'false');
        return [
          job,
          {
            result: skipped ? 'skipped' : 'success',
            outputs: job === 'changes' ? { build } : {},
          },
        ];
      },
    ),
  );
}

test('the aggregate accepts only planned skips', () => {
  for (const eventName of ['pull_request', 'push', 'workflow_dispatch']) {
    for (const build of ['true', 'false']) {
      const valid = results(build, eventName);
      verifyResults(valid, eventName);
      for (const job of Object.keys(valid)) {
        for (const result of ['success', 'failure', 'cancelled', 'skipped']) {
          if (valid[job].result === result) continue;
          assert.throws(() =>
            verifyResults({ ...valid, [job]: { ...valid[job], result } }, eventName),
          );
        }
      }
    }
  }
});

test('a failed changes job cannot pass the aggregate', () => {
  const needs = results('true', 'pull_request');
  needs.changes = { result: 'failure', outputs: {} };
  needs.verify = { result: 'skipped', outputs: {} };
  assert.throws(() => verifyResults(needs, 'pull_request'), /changes must finish as success/);
});

test('the changes command writes the job outputs', () => {
  const root = mkdtempSync(join(tmpdir(), 'vbnet-ci-policy-'));
  try {
    const event = join(root, 'event.json');
    const output = join(root, 'output');
    writeFileSync(event, '{}');
    runCommand('changes', {
      GITHUB_EVENT_NAME: 'push',
      GITHUB_EVENT_PATH: event,
      GITHUB_OUTPUT: output,
    });
    assert.equal(readFileSync(output, 'utf8'), 'build=true\nwindows=true\n');
    assert.throws(() => runCommand('nothing', {}), /unknown command/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
