#!/usr/bin/env node
// Parse rate: parses every *.vb file under one or more directories and
// reports, per corpus, how many parse with no ERROR or MISSING node. A
// corpus is `name=directory`.
//
//   node tools/parse-rate.mjs samples=../samples docs=../docs
//   node tools/parse-rate.mjs samples=../samples --out parse-rate.md
//
// The result is a measurement, not a gate: files that are not valid VB, and
// constructs the grammar does not cover, count against the rate.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTreeSitterCli } from './fixture-result.mjs';

const BATCH = 500;
const LISTED_FAILURES = 20;

export function vbFiles(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.vb'))
    .map((entry) => join(entry.parentPath, entry.name))
    .toSorted();
}

// The files that did not parse clean, from `tree-sitter parse --json-summary`
// output. Lines for failing files precede the JSON document.
export function failedFiles(proc, expected) {
  assert(!proc.error, `Could not run parser: ${proc.error?.message}`);
  // The CLI exits 1 when any file has an error node.
  assert(
    proc.status === 0 || proc.status === 1,
    `Parser exited ${proc.status ?? proc.signal}: ${proc.stderr}`,
  );
  const start = proc.stdout.search(/^\{\r?$/m);
  assert(start >= 0, `Parser printed no summary: ${proc.stderr}`);
  const summaries = JSON.parse(proc.stdout.slice(start)).parse_summaries;
  assert.equal(summaries.length, expected, 'Parser did not report every file');
  return summaries.filter((s) => !s.successful).map((s) => s.file);
}

export function report(results) {
  const lines = [
    '# Parse rate',
    '',
    '| Corpus | Files | Clean | Rate |',
    '| --- | ---: | ---: | ---: |',
  ];
  for (const { name, files, failed } of results) {
    const clean = files - failed.length;
    lines.push(`| ${name} | ${files} | ${clean} | ${((100 * clean) / files).toFixed(2)}% |`);
  }
  for (const { name, failed } of results.filter((r) => r.failed.length)) {
    lines.push('', `## Failing files in ${name}`, '');
    lines.push(...failed.slice(0, LISTED_FAILURES).map((file) => `- \`${file}\``));
    if (failed.length > LISTED_FAILURES) {
      lines.push(`- and ${failed.length - LISTED_FAILURES} more`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function measure(repo, cli, scratch, name, dir) {
  const files = vbFiles(dir);
  // An empty corpus means a failed checkout, not a perfect score.
  assert(files.length > 0, `No VB files found under ${dir}`);
  const failed = [];
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const list = join(scratch, 'paths.txt');
    writeFileSync(list, `${batch.join('\n')}\n`);
    const proc = spawnSync(cli, ['parse', '--quiet', '--json-summary', '--paths', list], {
      cwd: repo,
      encoding: 'utf8',
      maxBuffer: 1 << 27,
    });
    failed.push(...failedFiles(proc, batch.length));
  }
  return { name, files: files.length, failed: failed.map((file) => relative(dir, file)) };
}

function main(args) {
  const out = args.indexOf('--out');
  const outFile = out >= 0 ? args.splice(out, 2)[1] : undefined;
  assert(out < 0 || outFile, '--out needs a file name');
  const corpora = args.map((arg) => {
    const match = arg.match(/^([^=]+)=(.+)$/);
    assert(match, `Expected name=directory, got ${arg}`);
    return [match[1], resolve(match[2])];
  });
  assert(corpora.length > 0, 'Usage: node tools/parse-rate.mjs name=directory... [--out file]');
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const cli = resolveTreeSitterCli(repo);
  const scratch = mkdtempSync(join(tmpdir(), 'parse-rate-'));
  try {
    const text = report(corpora.map(([name, dir]) => measure(repo, cli, scratch, name, dir)));
    process.stdout.write(text);
    if (outFile) writeFileSync(outFile, text);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  main(process.argv.slice(2));
}
