#!/usr/bin/env node
// Fails when the npm package about to be published lacks a native prebuild
// for a platform the release builds one for. A published version cannot be
// replaced, so a package that leaves without its binaries stays that way.
//
//   node tools/prebuild-check.mjs    # from the package root
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const PLATFORMS = ['linux-x64', 'win32-x64'];

export function missingPrebuilds(paths) {
  const files = paths.map((path) => path.replaceAll('\\', '/'));
  return PLATFORMS.filter(
    (platform) =>
      !files.some((file) => file.startsWith(`prebuilds/${platform}/`) && file.endsWith('.node')),
  );
}

function main() {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    encoding: 'utf8',
  });
  const result = JSON.parse(output);
  const packages = Array.isArray(result) ? result : Object.values(result);
  assert.equal(packages.length, 1, 'Expected one npm package');
  const missing = missingPrebuilds(packages[0].files.map(({ path }) => path));
  assert.deepEqual(missing, [], `The npm package has no prebuild for: ${missing.join(', ')}`);
  console.log(`npm package carries prebuilds for ${PLATFORMS.join(' and ')}`);
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  main();
}
