/**
 * Zero-Gravity Browser - Lightweight Syntax Tokenizer (syntax-lite.js)
 * Single Source of Truth: Blueprint v2.3 Section 4.7
 * 
 * Custom lightweight tokenizer for Vanilla JS Scratchpad.
 * STRICT ENFORCEMENT: Zero Monaco or Ace dependencies.
 * Extracts language keywords, strings, comments, and workspace tags (@tag, #tag).
 */

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'class', 'import', 'export',
  'from', 'default', 'extends', 'if', 'else', 'for', 'while', 'do', 'switch',
  'case', 'break', 'continue', 'new', 'this', 'super', 'try', 'catch',
  'finally', 'throw', 'async', 'await', 'yield', 'typeof', 'instanceof',
  'null', 'undefined', 'true', 'false'
]);

/**
 * Escapes HTML entities to prevent XSS during syntax rendering
 * @param {string} str
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extracts workspace tags (@workspace, #tag) from text
 * @param {string} text
 * @returns {{ projects: string[], tags: string[] }}
 */
function extractWorkspaceTags(text) {
  if (typeof text !== 'string') return { projects: [], tags: [] };

  const projectMatches = text.match(/@[\w-]+/g) || [];
  const tagMatches = text.match(/#[\w-]+/g) || [];

  return {
    projects: Array.from(new Set(projectMatches)),
    tags: Array.from(new Set(tagMatches))
  };
}

/**
 * Tokenizes source code into typed tokens
 * @param {string} code
 * @returns {Array<{ type: string, value: string }>}
 */
function tokenize(code) {
  if (typeof code !== 'string') return [];

  const tokens = [];
  const regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[\w-]+)|(#[\w-]+)|(\b[a-zA-Z_$][\w$]*\b)|(\d+(?:\.\d+)?)|([{}()[\].,;:+\-*/%&|^!~=<>?]+)|(\s+)/g;

  let match;
  while ((match = regex.exec(code)) !== null) {
    const [full, comment, string, projectTag, hashTag, word, number, operator, whitespace] = match;

    if (comment) {
      tokens.push({ type: 'comment', value: comment });
    } else if (string) {
      tokens.push({ type: 'string', value: string });
    } else if (projectTag) {
      tokens.push({ type: 'project-tag', value: projectTag });
    } else if (hashTag) {
      tokens.push({ type: 'hash-tag', value: hashTag });
    } else if (word) {
      if (KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else {
        tokens.push({ type: 'identifier', value: word });
      }
    } else if (number) {
      tokens.push({ type: 'number', value: number });
    } else if (operator) {
      tokens.push({ type: 'operator', value: operator });
    } else if (whitespace) {
      tokens.push({ type: 'whitespace', value: whitespace });
    }
  }

  return tokens;
}

/**
 * Renders tokens to safe syntax-highlighted HTML spans
 * @param {string} code
 */
function highlightCodeToHtml(code) {
  const tokens = tokenize(code);
  return tokens.map(t => {
    const safe = escapeHtml(t.value);
    if (t.type === 'whitespace') return safe;
    return `<span class="tok-${t.type}">${safe}</span>`;
  }).join('');
}

module.exports = {
  tokenize,
  extractWorkspaceTags,
  highlightCodeToHtml,
  escapeHtml,
  KEYWORDS
};
