#!/usr/bin/env node
// Fuzzes incremental reparsing and fails when any case does. `tree-sitter
// fuzz` exits 0 even when cases fail, so the result has to be read from its
// output. The seed is random and printed; set TREE_SITTER_SEED to that value
// to replay a failure.
//
//   node tools/fuzz-check.mjs
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveTreeSitterCli, stripAnsi } from './fixture-result.mjs';

export function fuzzProblem(proc) {
  if (proc.error) return `could not run the fuzzer: ${proc.error.message}`;
  if (proc.signal) return `fuzzer terminated by ${proc.signal}`;
  if (proc.status !== 0) return `fuzzer exited ${proc.status}`;
  const failure = stripAnsi(`${proc.stdout}\n${proc.stderr}`).match(
    /^.*(?:Incorrect (?:initial )?parse|failed fuzzing).*$/m,
  );
  return failure ? failure[0].trim() : null;
}

function main() {
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const proc = spawnSync(
    resolveTreeSitterCli(repo),
    ['fuzz', '--iterations', '100', '--edits', '8'],
    { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 28 },
  );
  process.stdout.write(proc.stdout ?? '');
  process.stderr.write(proc.stderr ?? '');
  const problem = fuzzProblem(proc);
  if (problem) {
    console.error(`fuzz check failed: ${problem}`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  main();
}
