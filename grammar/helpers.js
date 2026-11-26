// One or more `rule`s separated by `separator`, no trailing separator.
export function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}

// One or more `rule`s separated by commas.
export function comma_sep1(rule) {
  return sep1(rule, ',');
}

// A case-insensitive keyword. VB keywords match in any letter case, so each
// one is a regular expression with the `i` flag, aliased to its usual
// spelling so queries and trees read `"Dim"` rather than a pattern. The
// grammar's `word` rule makes tree-sitter treat these as keywords: a keyword
// is produced only where the parser can accept it, so a member name such as
// `x.Select` or a variable named `text` still lexes as an identifier.
const keywords = new Map();
export function kw(word) {
  if (!keywords.has(word)) {
    keywords.set(word, alias(new RegExp(word, 'i'), word));
  }
  return keywords.get(word);
}

// One keyword from a list.
export function kws(...words) {
  return choice(...words.map(kw));
}

// `End <keyword>`, closing a block. The scanner emits the `End` only when a
// closing keyword follows it, so it never competes with a bare `End`
// statement inside the block.
export function end_kw($, ...words) {
  return seq(alias($._block_end, 'End'), kws(...words));
}

// Expression precedence, loosest first, following the VB language
// specification's operator precedence table.
export const PREC = {
  lambda: -1,
  query: 0,
  // assignment_statement sits at 1, below every operator.
  xor: 2,
  or: 3,
  and: 4,
  not: 5,
  comparison: 6,
  shift: 7,
  concat: 8,
  additive: 9,
  modulo: 10,
  integer_divide: 11,
  multiplicative: 12,
  unary: 13,
  exponent: 14,
  await: 15,
  postfix: 16,
};
