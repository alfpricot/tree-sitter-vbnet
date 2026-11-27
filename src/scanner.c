// External scanner for tree-sitter-vbnet.
//
// VB ends a statement at a line break, but a line break is ordinary
// whitespace wherever the statement cannot end yet: after a comma, an open
// parenthesis, a binary operator, an attribute, and so on. The scanner
// emits a `_newline` token only where the parser accepts one, which the
// valid-symbol list tells it; anywhere else it declines and the line break is
// skipped as whitespace. That one rule covers implicit line continuation,
// blank lines, and comment lines between statements.
//
// It also emits `#If`/`#Region`/... lines, the parts of an XML literal, the `(` of the `(Of` that opens a
// type argument list (so `Foo(Of T)` and `Foo(x)` part on one token of lookahead),
// the line break that opens a property's `Get`/`Set` accessors, and the
// `End` of a closing line: one token for statement blocks, another for members
// and types.
//
// Comments, ` _` line continuations, and that `End` are scanned here rather
// than by the generated lexer because each of them can start like an
// identifier (`REM`, `_`, `End`). In the generated lexer that overlap stops
// tree-sitter from moving keywords into its keyword table, which leaves every
// keyword in the main lexer and slows every token down.

#include "tree_sitter/alloc.h"
#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stdint.h>

enum TokenType {
  NEWLINE,
  ACCESSOR_NEWLINE,
  PREPROCESSOR_DIRECTIVE,
  COMMENT,
  LINE_CONTINUATION,
  BLOCK_END,
  MEMBER_END,
  OPEN_PAREN_OF,
  INTERPOLATED_TEXT,
  INTERPOLATION_FORMAT,
  QUERY_CLAUSE_FOLLOWS,
  XML_NAME,
  XML_TEXT,
  XML_ATTRIBUTE_VALUE,
  XML_COMMENT,
  XML_CDATA,
  XML_PROCESSING_INSTRUCTION,
  XML_DECLARATION,
  XML_MISC_FOLLOWS,
  INACTIVE_PREPROCESSOR_BRANCH,
  ERROR_SENTINEL,
};

#define WORD_MAX 16

// The branch of an `#If` that a `#` line opens and the parser does not see.
typedef enum {
  PARSED_BRANCH,
  // Under a condition that is literally false: up to the next `#ElseIf`,
  // `#Else`, or `#End If`.
  FALSE_BRANCH,
  // After the parsed branch: from an `#ElseIf` or `#Else` to the `#End If`.
  LATER_BRANCH,
} Branch;

typedef struct {
  // Set by a token that ends with a line break when a `#` directive comes
  // next. `get_column` counts from the last `\n`, so it cannot tell that a
  // line started after any other line break.
  bool directive_follows;
  // The branch that holds code and is the next token.
  Branch inactive_branch_follows;
  // Set after a skipped false branch: the `#ElseIf` or `#Else` that ends it
  // opens a branch that can be parsed. It lasts until that line.
  bool false_so_far;
} Scanner;

void *tree_sitter_vbnet_external_scanner_create(void) { return ts_calloc(1, sizeof(Scanner)); }
void tree_sitter_vbnet_external_scanner_destroy(void *payload) { ts_free(payload); }
unsigned tree_sitter_vbnet_external_scanner_serialize(void *payload, char *buffer) {
  Scanner *scanner = payload;
  unsigned state = scanner->directive_follows | scanner->false_so_far << 1 |
                   (unsigned)scanner->inactive_branch_follows << 2;
  if (state == 0) {
    return 0;
  }
  buffer[0] = (char)state;
  return 1;
}
void tree_sitter_vbnet_external_scanner_deserialize(void *payload, const char *buffer,
                                                     unsigned length) {
  Scanner *scanner = payload;
  unsigned state = length > 0 ? (unsigned char)buffer[0] : 0;
  scanner->directive_follows = state & 1;
  scanner->false_so_far = state & 2;
  scanner->inactive_branch_follows = (Branch)(state >> 2);
}

static inline void skip(TSLexer *lexer) { lexer->advance(lexer, true); }
static inline void consume(TSLexer *lexer) { lexer->advance(lexer, false); }

static inline bool is_line_break(int32_t c) {
  return c == '\n' || c == '\r' || c == 0x2028 || c == 0x2029 || c == 0x85;
}

static inline bool is_horizontal_space(int32_t c) {
  return c == ' ' || c == '\t' || c == '\f' || c == '\v' || c == 0xA0 || c == 0x1680 ||
         (c >= 0x2000 && c <= 0x200A) || c == 0x202F || c == 0x205F || c == 0x3000 ||
         c == 0xFEFF;
}

static inline bool is_ascii_letter(int32_t c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
}

// Every other code point above ASCII is taken as a letter, apart from the
// Unicode spaces and line breaks, which end a word as their ASCII forms do.
// U+FEFF is the exception: it is a format character, which the grammar's
// `identifier` lets continue a name, so it must not end a word here either.
static inline bool is_identifier_char(int32_t c) {
  return is_ascii_letter(c) || (c >= '0' && c <= '9') || c == '_' || c == 0xFEFF ||
         (c > 0x7F && !is_horizontal_space(c) && !is_line_break(c));
}

static inline bool is_comment_start(int32_t c) {
  return c == '\'' || c == 0x2018 || c == 0x2019;
}

// Consumes one line break, treating `\r\n` as one.
static void advance_line_break(TSLexer *lexer, bool skipping) {
  bool carriage_return = lexer->lookahead == '\r';
  lexer->advance(lexer, skipping);
  if (carriage_return && lexer->lookahead == '\n') {
    lexer->advance(lexer, skipping);
  }
}

static void advance_to_line_end(TSLexer *lexer, bool skipping) {
  while (!lexer->eof(lexer) && !is_line_break(lexer->lookahead)) {
    lexer->advance(lexer, skipping);
  }
}

static void skip_horizontal_space(TSLexer *lexer) {
  while (is_horizontal_space(lexer->lookahead)) {
    consume(lexer);
  }
}

// Reads an ASCII word, lowercased, into `word`. Returns false when the word
// is longer than the buffer or is followed by a non-ASCII identifier
// character, so a longer identifier never matches a keyword prefix.
static bool read_word(TSLexer *lexer, char word[WORD_MAX + 1]) {
  unsigned length = 0;
  while (is_identifier_char(lexer->lookahead)) {
    int32_t c = lexer->lookahead;
    if (!is_ascii_letter(c) || length == WORD_MAX) {
      word[0] = '\0';
      return false;
    }
    word[length++] = (char)(c | 0x20);
    consume(lexer);
  }
  word[length] = '\0';
  return length > 0;
}

static bool word_is(const char *word, const char *expected) {
  while (*word && *word == *expected) {
    word++;
    expected++;
  }
  return *word == '\0' && *expected == '\0';
}

static bool word_in(const char *word, const char *const *words, unsigned count) {
  for (unsigned i = 0; i < count; i++) {
    if (word_is(word, words[i])) {
      return true;
    }
  }
  return false;
}

// The keywords after `End` on a line that closes a statement block, and on
// one that closes a member or a type.
static const char *const block_closers[] = {
    "if", "select", "while", "with", "try", "using", "synclock",
};
#define BLOCK_CLOSER_COUNT (sizeof(block_closers) / sizeof(block_closers[0]))
static const char *const member_closers[] = {
    "sub",       "function", "class",      "module",        "structure",  "interface",
    "enum",      "namespace", "property",  "get",           "set",        "event",
    "operator",  "addhandler", "removehandler", "raiseevent",
};
#define MEMBER_CLOSER_COUNT (sizeof(member_closers) / sizeof(member_closers[0]))

// Reads the keyword of a `#` line, lowercased, into `word`. Unlike
// `read_word`, any character outside ASCII ends it, so a comment that opens
// with a typographic quote can touch the keyword, as after `#End If`; an ASCII
// digit or `_` after it makes it no keyword.
static bool read_directive_word(TSLexer *lexer, char word[WORD_MAX + 1]) {
  unsigned length = 0;
  while (is_ascii_letter(lexer->lookahead)) {
    if (length == WORD_MAX) {
      word[0] = '\0';
      return false;
    }
    word[length++] = (char)(lexer->lookahead | 0x20);
    consume(lexer);
  }
  word[length] = '\0';
  int32_t c = lexer->lookahead;
  if ((c >= '0' && c <= '9') || c == '_') {
    word[0] = '\0';
    return false;
  }
  return length > 0;
}

// What a line-break lookahead asks of the next line of code, given its first
// word, with the lexer just past that word. It reads no further than the line,
// and may reuse `word`.
typedef bool (*LineTest)(TSLexer *lexer, char word[WORD_MAX + 1]);

// The answer for the first line of code after an `#Else` that has no `#End If`:
// that code is parsed, but the lexer is at the end of the file by the time the
// missing `#End If` is known, so the line is tested on the way.
typedef struct {
  LineTest test;
  // Set once the first line of code in the branch has been tested. `answer`
  // means nothing without it.
  bool tested;
  // Set when the branch ran to the end of the file.
  bool unterminated;
  bool answer;
  // The lookahead's own copy of the scanner's flag of the same name.
  bool false_so_far;
} Probe;

// Tests the line at the lexer when it holds code: not a comment.
static void probe_line(TSLexer *lexer, Probe *probe) {
  char word[WORD_MAX + 1] = "";
  if (is_comment_start(lexer->lookahead)) {
    return;
  }
  if (read_word(lexer, word) && word_is(word, "rem")) {
    return;
  }
  probe->tested = true;
  probe->answer = probe->test(lexer, word);
}

static inline bool opens_later_branch(const char *word) {
  return word_is(word, "else") || word_is(word, "elseif");
}

// Whether nothing but a comment is left of a line: the lexer is at its end or at
// `'`, a typographic quote, or `REM`. Reads no further than that.
static bool at_line_end_or_comment(TSLexer *lexer) {
  int32_t c = lexer->lookahead;
  if (lexer->eof(lexer) || is_line_break(c) || is_comment_start(c)) {
    return true;
  }
  char word[WORD_MAX + 1];
  return read_word(lexer, word) && word_is(word, "rem");
}

// Whether the rest of an `#If` or `#ElseIf` line is a condition that is
// literally false: `False` or `0`, then an optional `Then` and comment. No
// other condition is evaluated.
static bool read_false_condition(TSLexer *lexer) {
  char word[WORD_MAX + 1];
  skip_horizontal_space(lexer);
  if (lexer->lookahead == '0') {
    consume(lexer);
    // A typographic quote counts as an identifier character, but starts a
    // comment here.
    if (is_identifier_char(lexer->lookahead) && !is_comment_start(lexer->lookahead)) {
      return false;
    }
  } else {
    // Not `read_word`, which would run on into a typographic quote.
    if (!read_directive_word(lexer, word) || !word_is(word, "false") ||
        (is_identifier_char(lexer->lookahead) && !is_comment_start(lexer->lookahead))) {
      return false;
    }
  }
  skip_horizontal_space(lexer);
  if ((lexer->lookahead | 0x20) != 't') {
    return at_line_end_or_comment(lexer);
  }
  if (!read_directive_word(lexer, word) || !word_is(word, "then") ||
      (is_identifier_char(lexer->lookahead) && !is_comment_start(lexer->lookahead))) {
    return false;
  }
  skip_horizontal_space(lexer);
  return at_line_end_or_comment(lexer);
}

// Reads the rest of a `#` line whose keyword is `word` and returns the branch
// it opens. `false_so_far` says whether every branch before an `#ElseIf` or
// `#Else` was false, and is brought up to date.
static Branch read_directive_rest(TSLexer *lexer, const char *word, bool *false_so_far) {
  Branch branch = PARSED_BRANCH;
  if (word_is(word, "if")) {
    *false_so_far = false;
    if (read_false_condition(lexer)) {
      branch = FALSE_BRANCH;
    }
  } else if (opens_later_branch(word)) {
    if (!*false_so_far) {
      branch = LATER_BRANCH;
    } else {
      *false_so_far = false;
      bool conditional = word_is(word, "elseif");
      if (!conditional) {
        // `#Else If` is `#ElseIf`.
        char next[WORD_MAX + 1];
        skip_horizontal_space(lexer);
        conditional = read_directive_word(lexer, next) && word_is(next, "if");
      }
      if (conditional && read_false_condition(lexer)) {
        branch = FALSE_BRANCH;
      }
    }
  }
  advance_to_line_end(lexer, false);
  return branch;
}

// How the reading of a branch that is not parsed ended.
typedef struct {
  // Set when the directive line that ends the branch was found.
  bool closed;
  // Set when the branch holds more than whitespace.
  bool content;
  // The keyword of that line when it is an `#ElseIf` or `#Else` ending a false
  // branch, with the lexer just past it; otherwise null.
  const char *later;
} BranchEnd;

// Reads the lines of a branch that is not parsed, from the start of its first
// line to the directive that ends it, which it stops on: `#End If`, or for a
// false branch also an `#ElseIf` or `#Else`. A branch with no such line is not
// skipped: while one is being typed, or after a mistyped closer, the code stays
// parsed. `#If` blocks nested in the branch are read through. With `mark`, the
// end of the token is marked after each character that is not whitespace. A
// `probe` is given the first line of code that is parsed if the branch turns out
// to have no end, and is told when that is so.
static BranchEnd read_inactive_branch(TSLexer *lexer, Branch branch, bool mark, Probe *probe) {
  unsigned depth = 0;
  bool content = false;
  // The depth of the outermost nested `#If` that is in a later branch, or zero,
  // and whether the probe had tested a line when that branch began.
  unsigned later = 0;
  bool tested_before = false;
  for (;;) {
    skip_horizontal_space(lexer);
    if (lexer->eof(lexer)) {
      break;
    }
    if (lexer->lookahead == '#') {
      consume(lexer);
      skip_horizontal_space(lexer);
      char word[WORD_MAX + 1];
      if (read_directive_word(lexer, word)) {
        if (word_is(word, "if")) {
          depth++;
        } else if (word_is(word, "end")) {
          skip_horizontal_space(lexer);
          if (read_directive_word(lexer, word) && word_is(word, "if")) {
            if (depth == 0) {
              return (BranchEnd){.closed = true, .content = content};
            }
            // That later branch is closed, so it is not parsed: what was tested
            // in it does not count.
            if (probe && depth == later) {
              probe->tested = tested_before;
              later = 0;
            }
            depth--;
          }
        } else if (depth == 0 && branch == FALSE_BRANCH && opens_later_branch(word)) {
          return (BranchEnd){.closed = true,
                             .content = content,
                             .later = word_is(word, "else") ? "else" : "elseif"};
        } else if (probe && depth > 0 && later == 0 && opens_later_branch(word)) {
          later = depth;
          tested_before = probe->tested;
        }
      }
      content = true;
      if (mark) {
        lexer->mark_end(lexer);
      }
    } else if (probe && !probe->tested && !is_line_break(lexer->lookahead)) {
      probe_line(lexer, probe);
    }
    while (!lexer->eof(lexer) && !is_line_break(lexer->lookahead)) {
      bool space = is_horizontal_space(lexer->lookahead);
      consume(lexer);
      if (!space) {
        content = true;
        if (mark) {
          lexer->mark_end(lexer);
        }
      }
    }
    if (lexer->eof(lexer)) {
      break;
    }
    advance_line_break(lexer, false);
  }
  if (probe) {
    probe->unterminated = true;
  }
  return (BranchEnd){.content = content};
}

// Passes the branches that are not parsed after a directive line that has been
// read and opens `branch`, and the directive lines that end them. A branch with
// no end is read to the end of the file, although it is parsed: lookahead
// cannot go back, so `probe` holds the answer for it.
static void pass_inactive_branches(TSLexer *lexer, Branch branch, bool *false_so_far,
                                   Probe *probe) {
  while (branch != PARSED_BRANCH && is_line_break(lexer->lookahead)) {
    advance_line_break(lexer, false);
    if (probe) {
      probe->tested = false;
    }
    BranchEnd end = read_inactive_branch(lexer, branch, false, probe);
    if (end.later) {
      *false_so_far = true;
      branch = read_directive_rest(lexer, end.later, false_so_far);
    } else {
      advance_to_line_end(lexer, false);
      branch = PARSED_BRANCH;
    }
  }
}

// Reads the keyword and the rest of a directive line, after its `#` and spaces,
// and passes what it opens.
static void pass_directive(TSLexer *lexer, bool *false_so_far, Probe *probe) {
  char word[WORD_MAX + 1];
  read_directive_word(lexer, word);
  Branch branch = read_directive_rest(lexer, word, false_so_far);
  pass_inactive_branches(lexer, branch, false_so_far, probe);
}

// Looks past a token that ended with a line break for a directive at the start
// of the new line. Used only for lookahead, so everything it reads is
// discarded; it leaves a directive line consumed, with any branches it opens
// that are not parsed, as `skip_to_next_word` would.
static void note_directive(TSLexer *lexer, Scanner *scanner, bool *false_so_far, Probe *probe) {
  skip_horizontal_space(lexer);
  if (lexer->lookahead != '#') {
    return;
  }
  consume(lexer);
  skip_horizontal_space(lexer);
  scanner->directive_follows = is_ascii_letter(lexer->lookahead);
  pass_directive(lexer, false_so_far, probe);
}

// Moves past blank lines, comment lines (`REM` ones too), and preprocessor
// lines, then reads the first word of the next line that holds code into
// `word`, which is left empty when that line starts with something else. Used
// only for lookahead past the end of a token, so everything it reads is
// discarded. Returns whether it passed a comment line or a line starting with
// `#`.
static bool skip_to_next_word(TSLexer *lexer, char word[WORD_MAX + 1], Probe *probe) {
  bool passed_extra = false;
  for (;;) {
    skip_horizontal_space(lexer);
    int32_t c = lexer->lookahead;
    if (lexer->eof(lexer)) {
      break;
    }
    if (is_line_break(c)) {
      advance_line_break(lexer, false);
    } else if (c == '_') {
      // A ` _` continuation joins the next line to this one. The lookahead
      // stops at a `_` with anything else after it, such as the one that
      // begins a name like `_take`.
      consume(lexer);
      skip_horizontal_space(lexer);
      if (!is_line_break(lexer->lookahead)) {
        break;
      }
      advance_line_break(lexer, false);
    } else if (c == '#') {
      // Branches that are not parsed are passed with the line that opens them.
      passed_extra = true;
      consume(lexer);
      skip_horizontal_space(lexer);
      pass_directive(lexer, &probe->false_so_far, probe);
    } else if (is_comment_start(c)) {
      passed_extra = true;
      advance_to_line_end(lexer, false);
    } else if (read_word(lexer, word) && word_is(word, "rem")) {
      passed_extra = true;
      advance_to_line_end(lexer, false);
    } else {
      return passed_extra;
    }
  }
  word[0] = '\0';
  return passed_extra;
}

// Whether what follows a word at the start of a line shows that the word is a
// name in a statement: a member access written against it, an assignment, or
// an empty argument list. No query clause goes on that way.
static bool follows_as_statement(TSLexer *lexer) {
  // `.`, `!`, and the `?` of `?.` or `?(`.
  if (lexer->lookahead == '.' || lexer->lookahead == '!' || lexer->lookahead == '?') {
    return true;
  }
  skip_horizontal_space(lexer);
  int32_t c = lexer->lookahead;
  if (c == '=') {
    return true;
  }
  if (c == '(') {
    consume(lexer);
    skip_horizontal_space(lexer);
    return lexer->lookahead == ')';
  }
  if (c == '<' || c == '>') {
    // `<<=` and `>>=`.
    consume(lexer);
    if (lexer->lookahead != c) {
      return false;
    }
  } else if (c != '+' && c != '-' && c != '*' && c != '/' && c != '\\' && c != '^' && c != '&') {
    return false;
  }
  consume(lexer);
  return lexer->lookahead == '=';
}

// Whether a line starting with `word` continues a query: `word` is a query
// operator keyword used as one. `Select Case` starts a statement, not a
// `Select` clause.
static bool line_continues_query(TSLexer *lexer, char word[WORD_MAX + 1]) {
  if (word_is(word, "select")) {
    skip_horizontal_space(lexer);
    char next[WORD_MAX + 1];
    return !(read_word(lexer, next) && word_is(next, "case"));
  }
  static const char *const operators[] = {
      "where", "order", "group", "join", "aggregate", "let",
      "distinct", "skip", "take", "from", "into",
  };
  for (unsigned i = 0; i < sizeof(operators) / sizeof(operators[0]); i++) {
    if (word_is(word, operators[i])) {
      return !follows_as_statement(lexer);
    }
  }
  return false;
}

// Whether the next line of code continues a query. Sets `passed_extra` when a
// comment or `#` line lies before that code.
static bool next_line_continues_query(TSLexer *lexer, Probe *probe, bool *passed_extra) {
  char word[WORD_MAX + 1];
  if (skip_to_next_word(lexer, word, probe)) {
    *passed_extra = true;
  }
  return probe->unterminated ? probe->tested && probe->answer
                             : line_continues_query(lexer, word);
}

// Passes an attribute block from its `<` through its `>`, over line breaks only
// with `multiline`.
static void pass_attribute_block(TSLexer *lexer, bool multiline) {
  while (!lexer->eof(lexer) && lexer->lookahead != '>') {
    if (lexer->lookahead == '"') {
      consume(lexer);
      while (!lexer->eof(lexer) && lexer->lookahead != '"' && !is_line_break(lexer->lookahead)) {
        consume(lexer);
      }
    }
    if (!is_line_break(lexer->lookahead)) {
      consume(lexer);
    } else if (multiline) {
      advance_line_break(lexer, false);
    } else {
      return;
    }
  }
  if (lexer->lookahead == '>') {
    consume(lexer);
  }
}

// Whether `word` and what follows it on its line are access modifiers and then
// `Get` or `Set`.
static bool words_start_accessor(TSLexer *lexer, char word[WORD_MAX + 1]) {
  while (word_is(word, "public") || word_is(word, "private") || word_is(word, "protected") ||
         word_is(word, "friend")) {
    skip_horizontal_space(lexer);
    read_word(lexer, word);
  }
  return word_is(word, "get") || word_is(word, "set");
}

// `words_start_accessor` for one line, which may open with attribute blocks.
static bool line_starts_accessor(TSLexer *lexer, char word[WORD_MAX + 1]) {
  while (word[0] == '\0' && lexer->lookahead == '<') {
    pass_attribute_block(lexer, false);
    skip_horizontal_space(lexer);
    read_word(lexer, word);
  }
  return words_start_accessor(lexer, word);
}

// Whether the next line of code starts a property accessor: optional
// attribute blocks and access modifiers, then `Get` or `Set`.
static bool next_line_starts_accessor(TSLexer *lexer, Probe *probe) {
  char word[WORD_MAX + 1];
  skip_to_next_word(lexer, word, probe);
  while (word[0] == '\0' && lexer->lookahead == '<') {
    pass_attribute_block(lexer, true);
    skip_to_next_word(lexer, word, probe);
  }
  return probe->unterminated ? probe->tested && probe->answer
                             : words_start_accessor(lexer, word);
}

static bool consume_through(TSLexer *lexer, const char *terminator, unsigned length);
static bool consume_word(TSLexer *lexer, const char *expected);

// Moves past blank lines to the first character of the next line that is not.
static void skip_blank_lines(TSLexer *lexer) {
  while (is_horizontal_space(lexer->lookahead) || is_line_break(lexer->lookahead)) {
    consume(lexer);
  }
}

// Whether the `<` at the lexer opens a whole comment or processing instruction.
// One that is not closed does not continue a document literal.
static bool starts_xml_misc(TSLexer *lexer) {
  consume(lexer);
  if (lexer->lookahead == '?') {
    consume(lexer);
    return consume_through(lexer, "?>", 2);
  }
  return consume_word(lexer, "!--") && consume_through(lexer, "-->", 3);
}

static bool scan_line_break(TSLexer *lexer, Scanner *scanner, const bool *valid_symbols,
                            bool error_recovery) {
  advance_line_break(lexer, false);
  lexer->mark_end(lexer);
  bool accessor = valid_symbols[ACCESSOR_NEWLINE];
  Probe probe = {.test = accessor ? line_starts_accessor : line_continues_query,
                 .false_so_far = scanner->false_so_far};
  note_directive(lexer, scanner, &probe.false_so_far, &probe);
  // Whether the line that follows is a comment or processing instruction that
  // may belong to a document literal. A `'` comment or a `#` line before one
  // ends the literal, so neither is passed. It is read for every break outside a
  // property header, whether or not a literal can go on here, so that a token
  // reused after an edit rests on the same text.
  bool markup_line = false;
  bool misc_follows = false;
  if (!accessor && !scanner->directive_follows) {
    skip_blank_lines(lexer);
    if (lexer->lookahead == '<') {
      markup_line = true;
      misc_follows = starts_xml_misc(lexer);
    }
  }
  if (error_recovery) {
    lexer->result_symbol = NEWLINE;
    return true;
  }
  if (accessor) {
    if (next_line_starts_accessor(lexer, &probe)) {
      lexer->result_symbol = ACCESSOR_NEWLINE;
      return true;
    }
  } else if (misc_follows && valid_symbols[XML_MISC_FOLLOWS]) {
    // The literal goes on. As for a query clause below, the generated lexer
    // could not read what follows, so the break is a continuation.
    lexer->result_symbol = LINE_CONTINUATION;
    return true;
  } else if (!markup_line && valid_symbols[QUERY_CLAUSE_FOLLOWS]) {
    // A line that starts with `<` opens no query clause.
    bool passed_extra = scanner->directive_follows;
    if (next_line_continues_query(lexer, &probe, &passed_extra)) {
      // The line break is whitespace: the query goes on. Left to the generated
      // lexer it would meet any comment or `#` line itself, so with one ahead
      // the break is taken as a continuation and the scanner gets to that line.
      if (passed_extra && valid_symbols[LINE_CONTINUATION]) {
        lexer->result_symbol = LINE_CONTINUATION;
        return true;
      }
      return false;
    }
  }
  if (!valid_symbols[NEWLINE]) {
    return false;
  }
  lexer->result_symbol = NEWLINE;
  return true;
}

// A `(` that optional spaces and the word `Of` follow. The token is the `(`
// alone; the rest is read ahead to tell it from any other parenthesis.
static bool scan_open_paren_of(TSLexer *lexer) {
  consume(lexer);
  lexer->mark_end(lexer);
  for (;;) {
    skip_horizontal_space(lexer);
    if (lexer->lookahead == '_') {
      // ` _` line continuation between `(` and `Of`.
      consume(lexer);
      skip_horizontal_space(lexer);
      if (!is_line_break(lexer->lookahead)) {
        return false;
      }
      advance_line_break(lexer, false);
    } else if (is_line_break(lexer->lookahead)) {
      advance_line_break(lexer, false);
    } else {
      break;
    }
  }
  if ((lexer->lookahead | 0x20) != 'o') {
    return false;
  }
  consume(lexer);
  if ((lexer->lookahead | 0x20) != 'f') {
    return false;
  }
  consume(lexer);
  if (is_identifier_char(lexer->lookahead)) {
    return false;
  }
  lexer->result_symbol = OPEN_PAREN_OF;
  return true;
}

static inline bool is_double_quote(int32_t c) {
  return c == '"' || c == 0x201C || c == 0x201D;
}

// Whether the line ahead, its leading spaces already read, is one that closes a
// member or a type: `End Sub` and the like, with nothing but a comment or a `:`
// after it.
static bool line_closes_member(TSLexer *lexer) {
  char word[WORD_MAX + 1];
  if (!read_word(lexer, word) || !word_is(word, "end")) {
    return false;
  }
  skip_horizontal_space(lexer);
  if (!read_word(lexer, word) || !word_in(word, member_closers, MEMBER_CLOSER_COUNT)) {
    return false;
  }
  skip_horizontal_space(lexer);
  int32_t c = lexer->lookahead;
  if (!(lexer->eof(lexer) || is_line_break(c) || is_comment_start(c) || c == ':')) {
    if (!read_word(lexer, word) || !word_is(word, "rem")) {
      return false;
    }
    c = lexer->lookahead;
  }
  // The answer rests on the whole of a multi-byte character.
  if (c > 0x7F) {
    consume(lexer);
  }
  return true;
}

// Text between the quotes and interpolations of `$"..."`: anything up to a
// lone quote or brace, with `{{`, `}}`, and any two quotes in a row as
// escapes.
static bool scan_interpolated_text(TSLexer *lexer) {
  bool has_content = false;
  for (;;) {
    int32_t c = lexer->lookahead;
    // Text that runs to the end of the file belongs to an unterminated string.
    // Declining it keeps the error at the opening quote.
    if (lexer->eof(lexer)) {
      return false;
    }
    // A string may span lines, so one left open would run to any later quote or
    // brace. It stops before a line that closes a member, which also rejects a
    // real string holding such a line. The text up to there is one token and the
    // line break another, a `_newline` the parser cannot accept here, so error
    // recovery resumes at the closing line.
    if (is_line_break(c)) {
      if (has_content) {
        lexer->mark_end(lexer);
      }
      advance_line_break(lexer, false);
      if (!has_content) {
        lexer->mark_end(lexer);
      }
      skip_horizontal_space(lexer);
      if (line_closes_member(lexer)) {
        lexer->result_symbol = has_content ? INTERPOLATED_TEXT : NEWLINE;
        return true;
      }
      has_content = true;
      continue;
    }
    if (is_double_quote(c) || c == '{' || c == '}') {
      lexer->mark_end(lexer);
      consume(lexer);
      bool escaped = is_double_quote(c) ? is_double_quote(lexer->lookahead) : lexer->lookahead == c;
      if (!escaped) {
        // The parser counts only the first byte of the character peeked at as
        // looked ahead. Reading past a multi-byte one makes an edit to its
        // later bytes invalidate this token.
        if (lexer->lookahead > 0x7F) {
          consume(lexer);
        }
        break;
      }
    }
    consume(lexer);
    has_content = true;
  }
  if (!has_content) {
    return false;
  }
  lexer->result_symbol = INTERPOLATED_TEXT;
  return true;
}

// The format specifier of an interpolation: everything up to the `}`.
static bool scan_interpolation_format(TSLexer *lexer) {
  bool has_content = false;
  while (!lexer->eof(lexer) && lexer->lookahead != '}' && !is_double_quote(lexer->lookahead) &&
         !is_line_break(lexer->lookahead)) {
    consume(lexer);
    has_content = true;
  }
  if (!has_content) {
    return false;
  }
  lexer->mark_end(lexer);
  lexer->result_symbol = INTERPOLATION_FORMAT;
  return true;
}

static void skip_whitespace(TSLexer *lexer) {
  while (is_horizontal_space(lexer->lookahead) || is_line_break(lexer->lookahead)) {
    skip(lexer);
  }
}

static inline bool is_xml_name_start(int32_t c) {
  return is_ascii_letter(c) || c == '_' ||
         (c > 0x7F && !is_horizontal_space(c) && !is_line_break(c));
}

static inline bool is_xml_name_char(int32_t c) {
  return is_identifier_char(c) || c == '-' || c == '.' || c == ':';
}

// The parser counts only the first byte of the character peeked at as looked
// ahead. A token that ends because of that character reads past it when it is
// a multi-byte one, so an edit to its later bytes invalidates the token.
static void mark_end_before(TSLexer *lexer) {
  lexer->mark_end(lexer);
  if (lexer->lookahead > 0x7F) {
    consume(lexer);
  }
}

// A name in a tag, with an optional `prefix:`.
static bool scan_xml_name(TSLexer *lexer) {
  skip_whitespace(lexer);
  if (!is_xml_name_start(lexer->lookahead)) {
    return false;
  }
  while (is_xml_name_char(lexer->lookahead)) {
    consume(lexer);
  }
  mark_end_before(lexer);
  lexer->result_symbol = XML_NAME;
  return true;
}

// `"..."` or `'...'`, quotes included.
static bool scan_xml_attribute_value(TSLexer *lexer) {
  skip_whitespace(lexer);
  int32_t quote = lexer->lookahead;
  if (quote != '"' && quote != '\'') {
    return false;
  }
  consume(lexer);
  while (lexer->lookahead != quote) {
    if (lexer->eof(lexer)) {
      return false;
    }
    consume(lexer);
  }
  consume(lexer);
  lexer->mark_end(lexer);
  lexer->result_symbol = XML_ATTRIBUTE_VALUE;
  return true;
}

// Consumes through `terminator`, at most three characters long. Returns false
// at the end of the file.
static bool consume_through(TSLexer *lexer, const char *terminator, unsigned length) {
  int32_t window[3] = {0, 0, 0};
  while (!lexer->eof(lexer)) {
    window[0] = window[1];
    window[1] = window[2];
    window[2] = lexer->lookahead;
    consume(lexer);
    bool matched = true;
    for (unsigned i = 0; i < length; i++) {
      if (window[3 - length + i] != terminator[i]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return true;
    }
  }
  return false;
}

// Consumes `expected`, returning false at the first character that differs.
static bool consume_word(TSLexer *lexer, const char *expected) {
  for (; *expected; expected++) {
    if (lexer->lookahead != *expected) {
      return false;
    }
    consume(lexer);
  }
  return true;
}

// `<!-- -->`, `<![CDATA[ ]]>`, or `<? ?>`, after the `<`. A `<?xml ...?>`
// where a document literal can start is its declaration.
static bool scan_xml_markup(TSLexer *lexer, const bool *valid_symbols) {
  consume(lexer);
  enum TokenType symbol;
  if (lexer->lookahead == '?') {
    consume(lexer);
    symbol = XML_PROCESSING_INSTRUCTION;
    if (valid_symbols[XML_DECLARATION] && consume_word(lexer, "xml") &&
        (lexer->lookahead == '?' || is_horizontal_space(lexer->lookahead) ||
         is_line_break(lexer->lookahead))) {
      symbol = XML_DECLARATION;
    }
    if (!consume_through(lexer, "?>", 2)) {
      return false;
    }
  } else if (lexer->lookahead == '!') {
    consume(lexer);
    if (lexer->lookahead == '-') {
      symbol = XML_COMMENT;
      if (!consume_word(lexer, "--") || !consume_through(lexer, "-->", 3)) {
        return false;
      }
    } else {
      symbol = XML_CDATA;
      if (!consume_word(lexer, "[CDATA[") || !consume_through(lexer, "]]>", 3)) {
        return false;
      }
    }
  } else {
    return false;
  }
  if (!valid_symbols[symbol]) {
    return false;
  }
  lexer->mark_end(lexer);
  lexer->result_symbol = symbol;
  return true;
}

static bool scan_block_end(TSLexer *lexer);

// Whether the line ahead, its leading spaces already read, is a closing line
// (`End Sub`, `End If`, ...). When it is not, what was read is text and the
// token is extended over it.
static bool text_line_closes(TSLexer *lexer) {
  char word[WORD_MAX + 1];
  if (!is_identifier_char(lexer->lookahead)) {
    return false;
  }
  if (read_word(lexer, word) && word_is(word, "end")) {
    skip_horizontal_space(lexer);
    if (is_identifier_char(lexer->lookahead) && read_word(lexer, word) &&
        (word_in(word, block_closers, BLOCK_CLOSER_COUNT) ||
         word_in(word, member_closers, MEMBER_CLOSER_COUNT))) {
      return true;
    }
  }
  lexer->mark_end(lexer);
  return false;
}

// The content of an element between its tags: text up to the next `<`, or a
// comment, CDATA section, or processing instruction. Whitespace around text,
// and whitespace alone between tags, belongs to no token. Text that runs to
// the end of the file belongs to an unterminated literal and is declined.
//
// Text also stops before a closing line, whose `End` is offered as it is
// outside a literal: in a literal left open, or one a stray `<` opened, only
// the lines before that closing line are lost, and error recovery resumes at
// it.
static bool scan_xml_content(TSLexer *lexer, const bool *valid_symbols) {
  bool line_start = false;
  while (is_horizontal_space(lexer->lookahead) || is_line_break(lexer->lookahead)) {
    line_start = line_start || is_line_break(lexer->lookahead);
    skip(lexer);
  }
  if (lexer->eof(lexer)) {
    return false;
  }
  if (lexer->lookahead == '<') {
    return scan_xml_markup(lexer, valid_symbols);
  }
  if (!valid_symbols[XML_TEXT]) {
    return false;
  }
  if (line_start && (lexer->lookahead | 0x20) == 'e') {
    if (scan_block_end(lexer)) {
      return true;
    }
    // What it read, at least the `e`, is text.
    lexer->mark_end(lexer);
  }
  while (lexer->lookahead != '<') {
    if (lexer->eof(lexer)) {
      return false;
    }
    int32_t c = lexer->lookahead;
    consume(lexer);
    if (is_line_break(c)) {
      skip_horizontal_space(lexer);
      if (text_line_closes(lexer)) {
        break;
      }
    } else if (!is_horizontal_space(c)) {
      lexer->mark_end(lexer);
    }
  }
  lexer->result_symbol = XML_TEXT;
  return true;
}

// ` _`, optional spaces, an optional comment, and the line break.
static bool scan_line_continuation(TSLexer *lexer, Scanner *scanner) {
  consume(lexer);
  skip_horizontal_space(lexer);
  if (is_comment_start(lexer->lookahead)) {
    advance_to_line_end(lexer, false);
  }
  if (!is_line_break(lexer->lookahead)) {
    return false;
  }
  advance_line_break(lexer, false);
  lexer->mark_end(lexer);
  bool false_so_far = scanner->false_so_far;
  note_directive(lexer, scanner, &false_so_far, NULL);
  lexer->result_symbol = LINE_CONTINUATION;
  return true;
}

// `REM` as a whole word starts a comment; `Remove` is an identifier.
static bool scan_rem_comment(TSLexer *lexer) {
  char word[WORD_MAX + 1];
  if (!read_word(lexer, word) || !word_is(word, "rem")) {
    return false;
  }
  if (is_identifier_char(lexer->lookahead)) {
    return false;
  }
  advance_to_line_end(lexer, false);
  lexer->mark_end(lexer);
  lexer->result_symbol = COMMENT;
  return true;
}

// The `End` of a closing line, when a block keyword follows it. Which token it
// is depends on that keyword alone, whether or not the parser accepts it here.
static bool scan_block_end(TSLexer *lexer) {
  char word[WORD_MAX + 1];
  if (!read_word(lexer, word) || !word_is(word, "end")) {
    return false;
  }
  lexer->mark_end(lexer);
  skip_horizontal_space(lexer);
  if (!read_word(lexer, word)) {
    return false;
  }
  if (word_in(word, block_closers, BLOCK_CLOSER_COUNT)) {
    lexer->result_symbol = BLOCK_END;
    return true;
  }
  if (word_in(word, member_closers, MEMBER_CLOSER_COUNT)) {
    lexer->result_symbol = MEMBER_END;
    return true;
  }
  return false;
}

// A `#` line. When it opens a branch that is not parsed, the lines of that
// branch are read ahead, and when they hold code and have an end the next token
// is that branch.
static bool scan_directive(TSLexer *lexer, Scanner *scanner) {
  consume(lexer);
  skip_horizontal_space(lexer);
  if (!is_ascii_letter(lexer->lookahead)) {
    return false;
  }
  char word[WORD_MAX + 1];
  read_directive_word(lexer, word);
  Branch branch = read_directive_rest(lexer, word, &scanner->false_so_far);
  lexer->mark_end(lexer);
  lexer->result_symbol = PREPROCESSOR_DIRECTIVE;
  if (branch != PARSED_BRANCH && is_line_break(lexer->lookahead)) {
    advance_line_break(lexer, false);
    BranchEnd end = read_inactive_branch(lexer, branch, false, NULL);
    if (end.closed && end.content) {
      scanner->inactive_branch_follows = branch;
    }
    if (end.later) {
      scanner->false_so_far = true;
    }
  }
  return true;
}

// A branch that is not parsed, from the first line of it that holds more than
// whitespace to the last one before the directive that ends it. A condition is
// not evaluated unless it is literally false, so otherwise the first branch of
// an `#If` is parsed and the later ones are not, and code that repeats a
// declaration's opening line in each branch parses as one declaration.
static bool scan_inactive_branch(TSLexer *lexer, Branch branch) {
  while (is_horizontal_space(lexer->lookahead) || is_line_break(lexer->lookahead)) {
    skip(lexer);
  }
  BranchEnd end = read_inactive_branch(lexer, branch, true, NULL);
  if (!end.closed || !end.content) {
    return false;
  }
  lexer->result_symbol = INACTIVE_PREPROCESSOR_BRANCH;
  return true;
}

bool tree_sitter_vbnet_external_scanner_scan(void *payload, TSLexer *lexer,
                                             const bool *valid_symbols) {
  Scanner *scanner = payload;
  bool error_recovery = valid_symbols[ERROR_SENTINEL];
  // Applies to this token only; the state is saved only when one is found.
  bool directive_follows = scanner->directive_follows;
  scanner->directive_follows = false;
  Branch inactive_branch_follows = scanner->inactive_branch_follows;
  scanner->inactive_branch_follows = PARSED_BRANCH;

  if (inactive_branch_follows != PARSED_BRANCH && valid_symbols[INACTIVE_PREPROCESSOR_BRANCH]) {
    return scan_inactive_branch(lexer, inactive_branch_follows);
  }

  // Inside `$"..."` every character is text, so nothing is skipped first.
  if (valid_symbols[INTERPOLATED_TEXT] && !error_recovery) {
    return scan_interpolated_text(lexer);
  }
  if (valid_symbols[INTERPOLATION_FORMAT] && !error_recovery) {
    return scan_interpolation_format(lexer);
  }
  // Inside an XML literal the generated lexer would read `'` as a comment, so
  // the scanner answers for every XML position.
  if (!error_recovery) {
    if (valid_symbols[XML_TEXT]) {
      return scan_xml_content(lexer, valid_symbols);
    }
    if (valid_symbols[XML_ATTRIBUTE_VALUE]) {
      return scan_xml_attribute_value(lexer);
    }
    if (valid_symbols[XML_NAME]) {
      return scan_xml_name(lexer);
    }
  }

  bool newline_valid = valid_symbols[NEWLINE] || valid_symbols[ACCESSOR_NEWLINE];
  // Whether only whitespace lies between the start of the line and the
  // current position: known once a line break is skipped or when the previous
  // token noted a directive, and otherwise (at the start of the file) worked
  // out from the column, which is only asked for at a `#` because
  // `get_column` rescans the line.
  bool skipped_line_break = false;
  uint32_t skipped_spaces = 0;

  for (;;) {
    int32_t c = lexer->lookahead;
    if (is_horizontal_space(c)) {
      skip(lexer);
      skipped_spaces++;
    } else if (is_line_break(c)) {
      if (newline_valid || error_recovery) {
        return scan_line_break(lexer, scanner, valid_symbols, error_recovery);
      }
      advance_line_break(lexer, true);
      skipped_line_break = true;
      skipped_spaces = 0;
    } else {
      break;
    }
  }

  if (lexer->eof(lexer)) {
    if (valid_symbols[NEWLINE] && !error_recovery) {
      lexer->mark_end(lexer);
      lexer->result_symbol = NEWLINE;
      return true;
    }
    return false;
  }

  int32_t c = lexer->lookahead;

  if (c == '#' && valid_symbols[PREPROCESSOR_DIRECTIVE] &&
      (skipped_line_break || directive_follows ||
       lexer->get_column(lexer) == skipped_spaces)) {
    return scan_directive(lexer, scanner);
  }

  if (is_comment_start(c) && valid_symbols[COMMENT]) {
    advance_to_line_end(lexer, false);
    lexer->mark_end(lexer);
    lexer->result_symbol = COMMENT;
    return true;
  }

  if (c == '_' && valid_symbols[LINE_CONTINUATION]) {
    return scan_line_continuation(lexer, scanner);
  }

  if ((c | 0x20) == 'r' && valid_symbols[COMMENT]) {
    return scan_rem_comment(lexer);
  }

  // At the start of a line a closing line is one even where nothing can close,
  // as after an unclosed parenthesis: `End` is reserved, so it is no name.
  if ((c | 0x20) == 'e' &&
      (skipped_line_break || valid_symbols[BLOCK_END] || valid_symbols[MEMBER_END])) {
    return scan_block_end(lexer);
  }

  // A comment, CDATA section, processing instruction, or declaration where an
  // expression can start. Any other `<` is left to the generated lexer.
  if (c == '<' && valid_symbols[XML_COMMENT] && !error_recovery) {
    return scan_xml_markup(lexer, valid_symbols);
  }

  if (lexer->lookahead == '(' && valid_symbols[OPEN_PAREN_OF]) {
    return scan_open_paren_of(lexer);
  }

  return false;
}
