import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotLines } from './node-kinds.mjs';

test('lists named kinds and their fields, sorted', () => {
  const types = [
    { type: 'method', named: true, fields: { name: {}, body: {} } },
    { type: 'block', named: true },
    { type: 'End', named: false },
  ];
  assert.deepEqual(snapshotLines(types), ['block', 'method', 'method.body', 'method.name']);
});
