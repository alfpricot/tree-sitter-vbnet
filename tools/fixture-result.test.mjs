import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { fixtureResult, rootNodeName } from './fixture-result.mjs';

const parsed = (stdout) => ({ status: 0, signal: null, stdout, stderr: '' });

test('the root node name is the start rule of the grammar', () => {
  assert.equal(rootNodeName(fileURLToPath(new URL('..', import.meta.url))), 'source_file');
});

test('a fixture result needs a tree under the given root', () => {
  assert.deepEqual(fixtureResult(parsed('(program [0, 0] - [1, 0])\n'), 'program'), {
    errors: 0,
    zeroWidth: 0,
  });
  assert.throws(
    () => fixtureResult(parsed('(program [0, 0] - [1, 0])\n'), 'source_file'),
    /source_file tree/,
  );
  assert.deepEqual(
    fixtureResult(parsed('(program [0, 0] - [1, 0]\n  (ERROR [0, 1] - [0, 1]))\n'), 'program'),
    { errors: 1, zeroWidth: 1 },
  );
});
