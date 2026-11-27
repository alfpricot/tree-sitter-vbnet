#!/usr/bin/env node
// Parser budget: two grammar mistakes slow every parse without failing a
// test. A token that overlaps identifiers can stop tree-sitter from moving
// keywords into its keyword lexer, and a rule repeated across expression
// contexts can grow the parse table sharply. Both show up in the generated
// src/parser.c, so this reads it and compares against test/parser-budget.json.
//
//   node tools/parser-budget.mjs
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function parserMetrics(source) {
  const stateCount = source.match(/^#define STATE_COUNT (\d+)\r?$/m);
  assert(stateCount, 'STATE_COUNT not found in the generated parser');
  // A parser with no keyword lexer has lost keyword extraction entirely.
  const lexer = source.match(/^static bool ts_lex_keywords\([\s\S]*?^\}/m);
  return {
    stateCount: Number(stateCount[1]),
    keywordAccepts: lexer ? (lexer[0].match(/ACCEPT_TOKEN/g) ?? []).length : 0,
  };
}

export function budgetProblems(metrics, budget) {
  const problems = [];
  if (metrics.keywordAccepts < budget.minKeywordAccepts) {
    problems.push(
      `keyword lexer accepts ${metrics.keywordAccepts} tokens, below the floor of ${budget.minKeywordAccepts}`,
    );
  }
  const maxStates = Math.floor((budget.stateCount * (100 + budget.maxStateGrowthPercent)) / 100);
  if (metrics.stateCount > maxStates) {
    problems.push(
      `STATE_COUNT is ${metrics.stateCount}, above ${maxStates} (baseline ${budget.stateCount} plus ${budget.maxStateGrowthPercent}%)`,
    );
  }
  return problems;
}

function main() {
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const budget = JSON.parse(readFileSync(join(repo, 'test/parser-budget.json'), 'utf8'));
  const metrics = parserMetrics(readFileSync(join(repo, 'src/parser.c'), 'utf8'));
  const problems = budgetProblems(metrics, budget);
  if (problems.length) {
    problems.forEach((p) => console.error(p));
    process.exit(1);
  }
  console.log(
    `parser within budget (${metrics.keywordAccepts} keyword tokens, ${metrics.stateCount} states)`,
  );
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  main();
}
