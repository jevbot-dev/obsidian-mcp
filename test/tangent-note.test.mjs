import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { tangentNoteData, tangentNoteHTML, tangentFrame, tangentSegments } from '../src/tangent-note.mjs';
const content = `# 正切对称中心
## 题目原文
y = 2\\tan\\left(x - \\dfrac{\\pi}{3}\\right)，求最小正值。
答案 C
## 完整解法
${[1,2,3,4,5].map(i=>'### Step '+i+' · 对称中心').join('\n')}`;
const note = {vault:'Math',path:'Q4.md',content};
test('example binds formula and ordered headings; unsupported examples do not get a fabricated answer',()=>{
 const d=tangentNoteData(note); assert.equal(d.mode,'example');assert.deepEqual(d.parameters,{A:2,omega:1,phi:-Math.PI/3});assert.equal(d.steps.length,5);assert.equal(d.answer.choice,'C');
 assert.equal(tangentNoteData({...note,content:content.replace('{3}','{4}')}),null);
 assert.equal(tangentNoteData({...note,content:content.replace('Step 3','Step 2')}),null);
 const generic=tangentNoteData({...note,content:'# 正切函数 $\\tan x$\n## 主要性质\n周期 π'});assert.equal(generic.mode,'generic');assert.equal(generic.answer,null);assert.equal(generic.steps.length,0);
});
test('capture clock interpolates stretch and shift continuously, then selects the correct positive center',()=>{
 const d=tangentNoteData(note);
 assert.equal(tangentFrame(d,1800).A,1);assert.equal(tangentFrame(d,3000).A,1.5);assert.equal(tangentFrame(d,4200).A,2);
 assert.equal(tangentFrame(d,5400).phi,-Math.PI/6);assert.equal(tangentFrame(d,6600).phi,-Math.PI/3);
 assert.equal(tangentFrame(d,9000).step,4);assert.deepEqual(tangentFrame(d,5400),tangentFrame(d,5400));
 const centers=[-2,-1,0,1,2].map(k=>k*Math.PI/2-d.parameters.phi);assert.equal(Math.min(...centers.filter(x=>x>0)),d.answer.minimum);
});
test('plot branches never join across an asymptote or escape the clipping range',()=>{
 for(const p of [{A:1,omega:1,phi:0},{A:2,omega:1,phi:-Math.PI/3},{A:3,omega:3,phi:Math.PI}]){
  const segments=tangentSegments(p);assert.ok(segments.length>1);
  for(const points of segments){const branch=x=>Math.floor((p.omega*x+p.phi+Math.PI/2)/Math.PI);
   assert.ok(points.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(y)<=5&&branch(x)===branch(points[0][0])));
  }
 }
});
test('HTML parses and note markup remains inert',()=>{
 assert.doesNotThrow(()=>new Script(tangentNoteHTML.match(/<script>([\s\S]*)<\/script>/)[1]));
 const d=tangentNoteData({...note,content:content.replace('求最小正值','<script>bad()</script>求最小正值')});assert.ok(d.excerptHTML.includes('&lt;script&gt;'));assert.ok(!d.excerptHTML.includes('<script>'));
});
