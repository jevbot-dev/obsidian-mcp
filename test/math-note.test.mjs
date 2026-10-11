import test from 'node:test';
import assert from 'node:assert/strict';
import { mathNoteData, mathNoteHTML } from '../src/math-note.mjs';
const note={vault:'Math',path:'概念/积分.md',content:'# 积分\n## 直觉讲解\n曲线 y=x^2。例子 $\\int_0^1 x\\,dx=1/2$\n## 教材原文\n图片'};
test('integral scene derives only from supported note content and preserves source',()=>{
 const data=mathNoteData(note);assert.equal(data.scene,'integral-area');assert.equal(data.vault,note.vault);assert.equal(data.path,note.path);assert.equal(data.functions[0].exact,.5);assert.equal(data.functions[1].exact,1/3);assert.ok(!data.excerpt.includes('图片'));
 assert.equal(mathNoteData({...note,content:'一篇关于正弦的笔记'}),null);assert.equal(mathNoteData({...note,content:'积分 y=x^2 但没有此区间的例子'}),null);
});
test('note content is bounded data, never executable markup',()=>{
 const d=mathNoteData({...note,content:note.content.replace('曲线','<script>bad()</script>曲线')+'x'.repeat(10000)});assert.ok(d.excerpt.includes('<script>'));assert.ok(!d.excerptHTML.includes('<script>'));assert.ok(d.excerptHTML.includes('&lt;script&gt;'));assert.ok(mathNoteHTML.includes("$('excerpt').innerHTML=d.excerptHTML"));assert.ok(!mathNoteHTML.includes('eval('));assert.ok(mathNoteHTML.includes("action:'open-source'"));
});
test('packaged inline scripts parse before WebKit loads them',async()=>{
 const {Script}=await import('node:vm');const {mathDemoHTML}=await import('../src/math-demo.mjs');
 for(const html of [mathNoteHTML,mathDemoHTML])assert.doesNotThrow(()=>new Script(html.match(/<script>([\s\S]*)<\/script>/)[1]));
});
