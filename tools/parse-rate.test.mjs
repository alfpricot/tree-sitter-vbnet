import { test } from 'node:test';
import assert from 'node:assert/strict';
import { failedFiles, report } from './parse-rate.mjs';

const summary = (parse_summaries) =>
  `a.vb\tParse: 0.1 ms\t(ERROR [0, 0] - [1, 0])\n${JSON.stringify({ parse_summaries }, null, 2)}\n`;
const proc = (stdout, extra = {}) => ({ status: 1, stdout, stderr: '', ...extra });

test('lists the files that did not parse clean', () => {
  const output = summary([
    { file: 'a.vb', successful: false },
    { file: 'b.vb', successful: true },
  ]);
  assert.deepEqual(failedFiles(proc(output), 2), ['a.vb']);
});

test('refuses a crashed run, missing output, or missing files', () => {
  assert.throws(() => failedFiles(proc('', { status: null, signal: 'SIGSEGV' }), 1), /SIGSEGV/);
  assert.throws(() => failedFiles(proc('nothing'), 1), /no summary/);
  assert.throws(() => failedFiles(proc(summary([])), 1), /every file/);
});

test('reports a rate per corpus and caps the failing-file list', () => {
  const failed = Array.from({ length: 22 }, (_, i) => `f${i}.vb`);
  const text = report([
    { name: 'clean', files: 4, failed: [] },
    { name: 'mixed', files: 88, failed },
  ]);
  assert.match(text, /\| clean \| 4 \| 4 \| 100\.00% \|/);
  assert.match(text, /\| mixed \| 88 \| 66 \| 75\.00% \|/);
  assert.match(text, /- `f19\.vb`\n- and 2 more/);
  assert.doesNotMatch(text, /f20\.vb|Failing files in clean/);
});
