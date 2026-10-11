import MarkdownIt from 'markdown-it';
import katex from 'katex';

// Server-side, offline formatting. Note HTML is escaped, links/images stay inert,
// and untrusted TeX cannot request URLs, HTML extensions or shared macros.
const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
md.renderer.rules.link_open = () => '';
md.renderer.rules.link_close = () => '';
md.renderer.rules.image = (tokens, index) => md.utils.escapeHtml(tokens[index].content || '图片');
md.inline.ruler.before('escape', 'note_math', (state, silent) => {
  const start = state.pos;
  if (state.src[start] !== '$') return false;
  const display = state.src[start + 1] === '$', delimiter = display ? '$$' : '$';
  const from = start + delimiter.length;
  if (!display && /\s/.test(state.src[from] || '')) return false;
  let end = from;
  while ((end = state.src.indexOf(delimiter, end)) !== -1) {
    let slashes = 0; for (let i = end - 1; i >= from && state.src[i] === '\\'; i--) slashes++;
    if (slashes % 2 === 0 && end > from && (display || !/\s/.test(state.src[end - 1]))) break;
    end += delimiter.length;
  }
  if (end === -1 || end > state.posMax) return false;
  if (!silent) { const token = state.push('note_math', '', 0); token.content = state.src.slice(from, end).trim(); token.meta = { display }; }
  state.pos = end + delimiter.length; return true;
});
md.inline.ruler.before('link', 'note_wikilink', (state, silent) => {
  if (state.src.slice(state.pos, state.pos+2) !== '[[') return false;
  const end = state.src.indexOf(']]', state.pos+2); if (end === -1) return false;
  if (!silent) { const token = state.push('text', '', 0); token.content = state.src.slice(state.pos+2,end).split('|').at(-1); }
  state.pos = end+2; return true;
});
md.renderer.rules.note_math = (tokens, index) => {
  const token = tokens[index];
  try { return katex.renderToString(token.content, { output:'mathml', displayMode:token.meta.display,
    trust:false, throwOnError:true, strict:'ignore', maxSize:10, maxExpand:500, macros:{} }); }
  catch { return '<code class="math-fallback">'+md.utils.escapeHtml(token.content)+'</code>'; }
};
export function renderNoteMarkdown(source) {
  return md.render(String(source).slice(0, 4000));
}
