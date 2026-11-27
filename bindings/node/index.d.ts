type BaseNode = {
  type: string;
  named: boolean;
};

type ChildNode = {
  multiple: boolean;
  required: boolean;
  types: BaseNode[];
};

// Assignable to what `tree-sitter` declares for a language's node types; a
// looser shape would stop `parser.setLanguage(binding)` from type-checking. In
// the file itself, `fields` and `children` are absent on nodes without any,
// and `children` is a single object, which the intersection lets you read.
type NodeInfo =
  | (BaseNode & {
      subtypes: BaseNode[];
    })
  | (BaseNode & {
      fields: { [name: string]: ChildNode };
      children: ChildNode[] & ChildNode;
    });

/**
 * The tree-sitter language object for this grammar.
 *
 * @see {@linkcode https://tree-sitter.github.io/node-tree-sitter/interfaces/Parser.Language.html Parser.Language}
 *
 * @example
 * import Parser from "tree-sitter";
 * import VbNet from "tree-sitter-vbnet";
 *
 * const parser = new Parser();
 * parser.setLanguage(VbNet);
 */
declare const binding: {
  /** The language name. */
  name: 'vbnet';

  /**
   * The inner language object.
   * @private
   */
  language: unknown;

  /**
   * The content of the `node-types.json` file for this grammar.
   *
   * @see {@linkplain https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types Static Node Types}
   */
  nodeTypeInfo: NodeInfo[];

  /** The syntax highlighting query for this grammar. */
  HIGHLIGHTS_QUERY?: string;
};

export default binding;
