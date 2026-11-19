/* Parse a JS object/array literal made only of '…' strings, identifier keys and [ ] { } : , — without executing code.
 * (vm.runInNewContext is not a sandbox: a literal like `this.constructor.constructor('return process')()` escapes it.)
 * Anything else throws. */
export function safeLiteral(src) {
  const re = /\s+|'([^'\\]*)'|([A-Za-z_]\w*)(?=\s*:)|([\[\]{}:,])/y;
  src = src.trim().replace(/^\(([\s\S]*)\)$/, '$1');
  let out = '', i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new Error(`unsupported token at ${i}: ${src.slice(i, i + 20)}`);
    out += m[1] !== undefined ? JSON.stringify(m[1]) : m[2] !== undefined ? JSON.stringify(m[2]) : (m[3] ?? '');
    i = re.lastIndex;
  }
  return JSON.parse(out.replace(/,([\]}])/g, '$1'));
}
