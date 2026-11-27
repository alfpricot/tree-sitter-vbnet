import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingPrebuilds } from './prebuild-check.mjs';

const linux = 'prebuilds/linux-x64/tree-sitter-vbnet.node';
const windows = 'prebuilds/win32-x64/tree-sitter-vbnet.node';

test('accepts a package with a binary for each platform', () => {
  assert.deepEqual(missingPrebuilds([linux, windows.replaceAll('/', '\\')]), []);
});

test('names each platform without a binary', () => {
  assert.deepEqual(missingPrebuilds([linux]), ['win32-x64']);
  assert.deepEqual(missingPrebuilds(['prebuilds/linux-x64/README', 'src/parser.c']), [
    'linux-x64',
    'win32-x64',
  ]);
});
