import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetProblems, parserMetrics } from './parser-budget.mjs';

const source = [
  '#define STATE_COUNT 100',
  'static bool ts_lex(TSLexer *lexer, TSStateId state) {',
  '      ACCEPT_TOKEN(sym_identifier);',
  '}',
  '',
  'static bool ts_lex_keywords(TSLexer *lexer, TSStateId state) {',
  '    case 1:',
  '      ACCEPT_TOKEN(aux_sym_if);',
  '    case 2:',
  '      ACCEPT_TOKEN(aux_sym_then);',
  '}',
  '',
  'static const int other = 0;',
].join('\n');

const budget = { minKeywordAccepts: 2, stateCount: 100, maxStateGrowthPercent: 10 };

test('reads the state count and only the keyword lexer tokens', () => {
  assert.deepEqual(parserMetrics(source), { stateCount: 100, keywordAccepts: 2 });
});

test('counts no keyword tokens when the keyword lexer is gone', () => {
  assert.equal(parserMetrics('#define STATE_COUNT 5\n').keywordAccepts, 0);
});

test('rejects a parser without a state count', () => {
  assert.throws(() => parserMetrics(''), /STATE_COUNT/);
});

test('accepts metrics at both limits', () => {
  assert.deepEqual(budgetProblems({ stateCount: 110, keywordAccepts: 2 }, budget), []);
});

test('reports each exceeded limit', () => {
  const problems = budgetProblems({ stateCount: 111, keywordAccepts: 1 }, budget);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /keyword lexer accepts 1/);
  assert.match(problems[1], /STATE_COUNT is 111/);
});

test('rejects a missing or non-numeric budget value', () => {
  const metrics = { stateCount: 1, keywordAccepts: 2 };
  for (const key of Object.keys(budget)) {
    for (const value of [undefined, '10']) {
      assert.throws(() => budgetProblems(metrics, { ...budget, [key]: value }), new RegExp(key));
    }
  }
});
