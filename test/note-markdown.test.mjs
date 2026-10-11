import test from 'node:test';import assert from 'node:assert/strict';
import { renderNoteMarkdown } from '../src/note-markdown.mjs';
test('formats Markdown and inline/block TeX without changing code blocks',()=>{
 const html=renderNoteMarkdown('**面积** $\\int_0^1 x\\,dx=\\frac{1}{2}$\n\n- [[积分|积分概念]]\n\n$$\n\\sum_{i=1}^n i\n$$\n\n`$x^2$`');
 assert.ok(html.includes('<strong>面积</strong>'));assert.ok(html.includes('<math'));assert.ok(html.includes('<mfrac>'));assert.ok(html.includes('display="block"'));assert.ok(html.includes('<li>积分概念</li>'));assert.ok(html.includes('<code>$x^2$</code>'));
});
test('raw HTML, Markdown images/links and TeX URL/HTML commands remain inert',()=>{
 const html=renderNoteMarkdown('<script>alert(1)</script>\n\n[link](https://example.com) ![photo](https://example.com/x.png) $\\href{javascript:bad}{x}$ $\\htmlClass{evil}{x}$');
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('<a '));assert.ok(!html.includes('class="evil"'));assert.ok(html.includes('&lt;script&gt;'));
});
test('malformed formulas preserve readable escaped source',()=>{assert.ok(renderNoteMarkdown('$\\frac{$').includes('math-fallback'))});
