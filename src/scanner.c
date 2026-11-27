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
// It also emits `#If`/`#Region`/... lines, the `(` of the `(Of` that opens a
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
  ERROR_SENTINEL,
};

#define WORD_MAX 16

typedef struct {
  // Set by a token that ends with a line break when a `#` directive comes
  // next. `get_column` counts from the last `\n`, so it cannot tell that a
  // line started after any other line break.
  bool directive_follows;
} Scanner;

void *tree_sitter_vbnet_external_scanner_create(void) { return ts_calloc(1, sizeof(Scanner)); }
void tree_sitter_vbnet_external_scanner_destroy(void *payload) { ts_free(payload); }
unsigned tree_sitter_vbnet_external_scanner_serialize(void *payload, char *buffer) {
  Scanner *scanner = payload;
  if (!scanner->directive_follows) {
    return 0;
  }
  buffer[0] = 1;
  return 1;
}
void tree_sitter_vbnet_external_scanner_deserialize(void *payload, const char *buffer,
                                                     unsigned length) {
  (void)buffer;
  Scanner *scanner = payload;
  scanner->directive_follows = length > 0;
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

// Looks past a token that ended with a line break for a directive at the start
// of the new line. Used only for lookahead, so everything it reads is
// discarded; it leaves a directive line consumed, as `skip_to_next_code` would.
static void note_directive(TSLexer *lexer, Scanner *scanner) {
  skip_horizontal_space(lexer);
  if (lexer->lookahead != '#') {
    return;
  }
  consume(lexer);
  skip_horizontal_space(lexer);
  scanner->directive_follows = is_ascii_letter(lexer->lookahead);
  advance_to_line_end(lexer, false);
}

// Moves past blank lines, comment lines, and preprocessor lines to the first
// character of the next line that holds code. Used only for lookahead past
// the end of a token, so everything it reads is discarded. Returns whether it
// passed a line starting with `#`.
static bool skip_to_next_code(TSLexer *lexer) {
  bool passed_directive = false;
  for (;;) {
    skip_horizontal_space(lexer);
    int32_t c = lexer->lookahead;
    if (lexer->eof(lexer)) {
      return passed_directive;
    }
    if (is_line_break(c)) {
      advance_line_break(lexer, false);
    } else if (c == '_') {
      // A ` _` continuation joins the next line to this one.
      consume(lexer);
      skip_horizontal_space(lexer);
      if (!is_line_break(lexer->lookahead)) {
        return passed_directive;
      }
      advance_line_break(lexer, false);
    } else if (is_comment_start(c) || c == '#') {
      passed_directive = passed_directive || c == '#';
      advance_to_line_end(lexer, false);
    } else {
      return passed_directive;
    }
  }
}

// Whether the next line of code continues a query: it starts with a query
// operator keyword. `Select Case` starts a statement, not a `Select` clause.
// Sets `passed_directive` when a `#` line lies before that code.
static bool next_line_continues_query(TSLexer *lexer, bool *passed_directive) {
  if (skip_to_next_code(lexer)) {
    *passed_directive = true;
  }
  char word[WORD_MAX + 1];
  if (!read_word(lexer, word)) {
    return false;
  }
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
      return true;
    }
  }
  return false;
}

// Whether the next line of code starts a property accessor: optional
// attribute blocks and access modifiers, then `Get` or `Set`.
static bool next_line_starts_accessor(TSLexer *lexer) {
  skip_to_next_code(lexer);
  for (;;) {
    skip_horizontal_space(lexer);
    if (lexer->lookahead == '<') {
      while (!lexer->eof(lexer) && lexer->lookahead != '>') {
        if (lexer->lookahead == '"') {
          consume(lexer);
          while (!lexer->eof(lexer) && lexer->lookahead != '"' &&
                 !is_line_break(lexer->lookahead)) {
            consume(lexer);
          }
        }
        if (is_line_break(lexer->lookahead)) {
          advance_line_break(lexer, false);
        } else {
          consume(lexer);
        }
      }
      consume(lexer);
      skip_to_next_code(lexer);
      continue;
    }
    char word[WORD_MAX + 1];
    if (!read_word(lexer, word)) {
      return false;
    }
    if (word_is(word, "get") || word_is(word, "set")) {
      return true;
    }
    if (!(word_is(word, "public") || word_is(word, "private") || word_is(word, "protected") ||
          word_is(word, "friend"))) {
      return false;
    }
  }
}

static bool scan_line_break(TSLexer *lexer, Scanner *scanner, const bool *valid_symbols,
                            bool error_recovery) {
  advance_line_break(lexer, false);
  lexer->mark_end(lexer);
  note_directive(lexer, scanner);
  if (error_recovery) {
    lexer->result_symbol = NEWLINE;
    return true;
  }
  if (valid_symbols[ACCESSOR_NEWLINE]) {
    if (next_line_starts_accessor(lexer)) {
      lexer->result_symbol = ACCESSOR_NEWLINE;
      return true;
    }
  } else if (valid_symbols[QUERY_CLAUSE_FOLLOWS]) {
    bool passed_directive = scanner->directive_follows;
    if (next_line_continues_query(lexer, &passed_directive)) {
      // The line break is whitespace: the query goes on. Left to the generated
      // lexer it would meet any `#` line itself, so with one ahead the break is
      // taken as a continuation and the scanner gets to the directive.
      if (passed_directive && valid_symbols[LINE_CONTINUATION]) {
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
  note_directive(lexer, scanner);
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

static bool word_in(const char *word, const char *const *words, unsigned count) {
  for (unsigned i = 0; i < count; i++) {
    if (word_is(word, words[i])) {
      return true;
    }
  }
  return false;
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
  static const char *const block_closers[] = {
      "if", "select", "while", "with", "try", "using", "synclock",
  };
  static const char *const member_closers[] = {
      "sub",       "function", "class",      "module",        "structure",  "interface",
      "enum",      "namespace", "property",  "get",           "set",        "event",
      "operator",  "addhandler", "removehandler", "raiseevent",
  };
  if (word_in(word, block_closers, sizeof(block_closers) / sizeof(block_closers[0]))) {
    lexer->result_symbol = BLOCK_END;
    return true;
  }
  if (word_in(word, member_closers, sizeof(member_closers) / sizeof(member_closers[0]))) {
    lexer->result_symbol = MEMBER_END;
    return true;
  }
  return false;
}

static bool scan_directive(TSLexer *lexer) {
  consume(lexer);
  skip_horizontal_space(lexer);
  if (!is_ascii_letter(lexer->lookahead)) {
    return false;
  }
  advance_to_line_end(lexer, false);
  lexer->mark_end(lexer);
  lexer->result_symbol = PREPROCESSOR_DIRECTIVE;
  return true;
}

bool tree_sitter_vbnet_external_scanner_scan(void *payload, TSLexer *lexer,
                                             const bool *valid_symbols) {
  Scanner *scanner = payload;
  bool error_recovery = valid_symbols[ERROR_SENTINEL];
  // Applies to this token only; the state is saved only when one is found.
  bool directive_follows = scanner->directive_follows;
  scanner->directive_follows = false;

  // Inside `$"..."` every character is text, so nothing is skipped first.
  if (valid_symbols[INTERPOLATED_TEXT] && !error_recovery) {
    return scan_interpolated_text(lexer);
  }
  if (valid_symbols[INTERPOLATION_FORMAT] && !error_recovery) {
    return scan_interpolation_format(lexer);
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
    return scan_directive(lexer);
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

  if (lexer->lookahead == '(' && valid_symbols[OPEN_PAREN_OF]) {
    return scan_open_paren_of(lexer);
  }

  return false;
}
