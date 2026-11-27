import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// A static import, so a bundler sees the file and embeds it, and a package
// without it fails here rather than exporting no node type metadata.
import nodeTypeInfo from '../../src/node-types.json' with { type: 'json' };

const root = fileURLToPath(new URL('../..', import.meta.url));

const binding =
  typeof process.versions.bun === 'string'
    ? // Support `bun build --compile` by being statically analyzable enough to find the .node file at build-time
      await import(`${root}/prebuilds/${process.platform}-${process.arch}/tree-sitter-vbnet.node`)
    : (await import('node-gyp-build')).default(root);

binding.nodeTypeInfo = nodeTypeInfo;

const queries = [['HIGHLIGHTS_QUERY', `${root}/queries/highlights.scm`]];

for (const [prop, path] of queries) {
  Object.defineProperty(binding, prop, {
    configurable: true,
    enumerable: true,
    get() {
      delete binding[prop];
      try {
        binding[prop] = readFileSync(path, 'utf8');
      } catch {
        // A missing query file leaves the property undefined.
      }
      return binding[prop];
    },
  });
}

export default binding;
