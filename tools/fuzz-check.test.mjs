import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuzzProblem } from './fuzz-check.mjs';

const run = (stdout, extra = {}) => ({ status: 0, signal: null, stdout, stderr: '', ...extra });

test('passes a clean run', () => {
  assert.equal(
    fuzzProblem(run('fuzz seed: 1\n  1. vbnet - corpus - layout - Leading colon\n')),
    null,
  );
});

test('fails on failures reported with a zero exit status', () => {
  assert.match(fuzzProblem(run('65 vbnet corpus tests failed fuzzing\n')), /failed fuzzing/);
  assert.match(fuzzProblem(run('Incorrect initial parse for vbnet - x\n')), /initial parse/);
  assert.match(
    fuzzProblem(run('\u001b[31mIncorrect parse - x\u001b[0m\n')),
    /^Incorrect parse - x$/,
  );
});

test('fails on a crash, a signal, or a nonzero exit', () => {
  assert.match(fuzzProblem(run('', { error: new Error('ENOENT') })), /ENOENT/);
  assert.match(fuzzProblem(run('', { status: null, signal: 'SIGSEGV' })), /SIGSEGV/);
  assert.match(fuzzProblem(run('', { status: 1 })), /exited 1/);
});
