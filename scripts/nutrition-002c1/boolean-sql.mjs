// A conservative token-tree rule for pg_dump's parenthesized boolean output.
// It preserves every token, quoted literal/identifier, operand and evaluation
// order. Only redundant singleton parentheses and same-operator AND/OR nesting
// with fully parenthesized operands are normalized. This is not a SQL evaluator.
export function canonicalBooleanSql(sql) {
  if (typeof sql !== 'string' || sql.length > 1000000) throw new Error('N002C1_SQL_TREE_INPUT');
  const tokens = [];
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'" || c === '"') {
      const start = i++, escape = c === "'" && tokens.at(-1) === 'E';
      let closed = false;
      while (i < sql.length) {
        if (escape && sql[i] === '\\') { i += 2; continue; }
        if (sql[i++] === c) {
          if (sql[i] === c) { i++; continue; }
          closed = true; break;
        }
      }
      if (!closed) throw new Error('N002C1_SQL_TREE_LITERAL');
      tokens.push(sql.slice(start, i)); continue;
    }
    if (c === '$' || sql.slice(i,i+2) === '--' || sql.slice(i,i+2) === '/*') throw new Error('N002C1_SQL_TREE_UNSUPPORTED');
    if (tokens.length > 100000) throw new Error('N002C1_SQL_TREE_LIMIT');
    const word = /^[A-Za-z_][A-Za-z_0-9$]*/.exec(sql.slice(i));
    if (word) { tokens.push(word[0]); i += word[0].length; continue; }
    tokens.push(c); i++;
  }
  let cursor = 0;
  function group(nested, depth = 0) {
    if (depth > 128) throw new Error('N002C1_SQL_TREE_LIMIT');
    const children = [];
    while (cursor < tokens.length) {
      const token = tokens[cursor++];
      if (token === ')') {
        if (!nested) throw new Error('N002C1_SQL_TREE_UNBALANCED');
        return normalize(children);
      }
      children.push(token === '(' ? group(true, depth + 1) : token);
    }
    if (nested) throw new Error('N002C1_SQL_TREE_UNBALANCED');
    return normalize(children);
  }
  function normalize(children) {
    if (children.length === 1 && typeof children[0] === 'object') return children[0];
    const operator = children[1];
    if (children.length >= 3 && children.length % 2 === 1 && ['AND', 'OR'].includes(operator) &&
      children.every((child, index) => index % 2 ? child === operator : typeof child === 'object')) {
      const operands = children.filter((_, index) => index % 2 === 0)
        .flatMap(child => child.operator === operator ? child.operands : [child]);
      return { operator, operands };
    }
    return { tokens: children };
  }
  return group(false);
}
