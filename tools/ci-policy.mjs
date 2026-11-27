// Shared with other tree-sitter grammar repositories; the reference copy is in
// https://github.com/alfpricot/tree-sitter-snowflake. The path lists below are
// this repository's own.
//
// Decides which Verify jobs a change needs, and whether the jobs that did not
// run were meant to be skipped.
//
//   node tools/ci-policy.mjs changes   writes `build` and `windows` outputs
//   node tools/ci-policy.mjs verify    checks the job results in JOB_RESULTS
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BUILD_JOBS = new Set(['verify', 'node-binding']);

// Only prose and repository metadata that nothing builds or tests can skip the
// build jobs. LICENSE (package check), .editorconfig (formatter), and
// .gitattributes (line endings) are read by them, so they are not listed.
export function docsOnly(files) {
  return (
    files.length > 0 &&
    files.every((path) =>
      /^(?:[^/]+\.md|docs\/.*\.md|NOTICE|\.github\/(?:CODEOWNERS|dependabot\.yml))$/.test(path),
    )
  );
}

// What the addon build or its tests treat differently on Windows: the binding
// and its manifest, the hand-written scanner and the headers it includes, line
// ending rules, and the workflow that defines the job.
export function needsWindowsBinding(files) {
  return files.some((path) =>
    /^(?:bindings\/node\/|binding\.gyp$|package(?:-lock)?\.json$|src\/scanner\.c$|src\/tree_sitter\/|\.gitattributes$|\.nvmrc$|\.github\/workflows\/verify\.yml$)/.test(
      path,
    ),
  );
}

// Without rename detection, so moving a source file into a prose path still
// lists the path it left.
/**
 * @param {string} base
 * @param {string} head
 * @param {(command: string, args: string[], options: object) => any} [run]
 */
export function changedPaths(base, head, run = execFileSync) {
  return run('git', ['diff', '--no-renames', '--name-only', '-z', `${base}...${head}`], {
    encoding: 'utf8',
  })
    .toString()
    .split('\0')
    .filter(Boolean);
}

// A title or body edit carries no new commit, so the build can be skipped, but
// only when the last completed run for this head succeeded: otherwise the edit
// would report success over a failed build. A base change needs a full run.
export function canSkipEditedBuild(event, priorVerified) {
  return event.action === 'edited' && !event.changes?.base && priorVerified;
}

// Every event but a pull request runs the whole matrix.
export function plan(eventName, event, priorVerified, paths = changedPaths) {
  if (eventName !== 'pull_request') return { build: true, windows: true };
  if (canSkipEditedBuild(event, priorVerified)) return { build: false, windows: false };
  const files = paths(event.pull_request.base.sha, event.pull_request.head.sha);
  return { build: !docsOnly(files), windows: needsWindowsBinding(files) };
}

export function verifyResults(needs, eventName) {
  for (const [job, value] of Object.entries(needs)) {
    let expected = 'success';
    if (job === 'pr-title' && eventName !== 'pull_request') expected = 'skipped';
    if (BUILD_JOBS.has(job) && needs.changes?.outputs?.build === 'false') expected = 'skipped';
    assert.equal(value.result, expected, `${job} must finish as ${expected}`);
  }
}

export function runCommand(command, env = process.env) {
  if (command === 'changes') {
    const event = JSON.parse(readFileSync(/** @type {string} */ (env.GITHUB_EVENT_PATH), 'utf8'));
    const { build, windows } = plan(env.GITHUB_EVENT_NAME, event, env.PRIOR_VERIFIED === 'true');
    appendFileSync(
      /** @type {string} */ (env.GITHUB_OUTPUT),
      `build=${build}\nwindows=${windows}\n`,
    );
  } else if (command === 'verify') {
    verifyResults(JSON.parse(/** @type {string} */ (env.JOB_RESULTS)), env.GITHUB_EVENT_NAME);
  } else {
    throw new Error(`ci-policy: unknown command ${JSON.stringify(command)}`);
  }
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  runCommand(process.argv[2]);
}
