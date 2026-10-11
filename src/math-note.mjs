import { tangentNoteData } from './tangent-note.mjs';
import { renderNoteMarkdown } from './note-markdown.mjs';
// Only predefined mathematical scenes are selected from note text. Never execute vault HTML.
export const mathNoteURI = 'ui://obsidian/math-note';
export function mathNoteData(note) {
  const tangent = tangentNoteData(note); if (tangent) return tangent;
  if (typeof note.content !== 'string' || !/积分/.test(note.content) || !/\\int_0\^1\s*x(?:\s|\\|\,)/.test(note.content) || !/y\s*=\s*x\^2/.test(note.content)) return null;
  const excerpt = note.content.split('## 直觉讲解')[1]?.split('## 教材原文')[0]?.trim() ?? note.content;
  return { scene: 'integral-area', vault: note.vault, path: note.path, title: note.path.split('/').at(-1).replace(/\.md$/, ''),
    excerpt: excerpt.slice(0, 2600), excerptHTML: renderNoteMarkdown(excerpt.slice(0, 2600)), truncated: excerpt.length > 2600,
    functions: [{ id: 'linear', label: 'y = x', exact: 0.5, formula: '∫₀¹ x dx = ½' },
      { id: 'quadratic', label: 'y = x²', exact: 1/3, formula: '∫₀¹ x² dx = ⅓' }],
    explanation: '笔记以 y=x 的三角形面积说明积分，并以 y=x² 引出曲线下面积。动画使用左端点矩形近似；矩形越细，面积和越接近积分。' };
}
export const mathNoteHTML = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{color-scheme:light dark;font:14px system-ui;background:#fff;color:#25282c}*{box-sizing:border-box}body{margin:0;padding:20px}h2{font-size:20px;margin:0 0 8px}p{line-height:1.65}.muted,small{color:#747983}.panel{border:1px solid #ddd;border-radius:14px;padding:16px}canvas{display:block;width:100%;height:280px}.controls{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin:16px 0}label{display:grid;gap:8px;flex:1;min-width:180px}input{width:100%;accent-color:#3c9878}button,select{font:inherit;border:1px solid #ddd;border-radius:8px;background:#f4f5f7;color:inherit;padding:8px 12px}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}.values{font-variant-numeric:tabular-nums;line-height:1.8}#excerpt{overflow-wrap:anywhere;line-height:1.8;max-height:560px;overflow:auto;padding-right:8px}#excerpt p{margin:14px 0}#excerpt ul{padding-left:24px}#excerpt math{font-size:1.12em}#excerpt math[display="block"]{margin:16px 0;overflow-x:auto}#excerpt code{font:13px ui-monospace,monospace;white-space:pre-wrap}#excerpt strong{font-weight:650}#status{color:#747983}#status:empty{display:none}@media(prefers-color-scheme:dark){:root{background:#23252b;color:#eee}.panel,button,select{border-color:#484b53}button,select{background:#32353c}}
#open{display:inline-block;margin:0 0 14px;padding:0;border:0;border-radius:2px;background:transparent;color:#496acb;font:13px/1.6 system-ui;text-decoration:none}#open:hover:not(:disabled){text-decoration:underline}#open:focus-visible{outline:2px solid currentColor;outline-offset:3px}@media(prefers-color-scheme:dark){#open{color:#99b1ff}}
details{margin-top:var(--jevbot-space-block,24px)}details>summary{display:flex;align-items:center;gap:6px;width:fit-content;list-style:none;cursor:pointer;font:13px/1.6 system-ui;color:#747983}details>summary::-webkit-details-marker{display:none}details>summary::before{content:"›";display:inline-block;font:18px/1 system-ui;transition:transform .15s}details[open]>summary::before{transform:rotate(90deg)}details>summary:hover{color:#496acb}details>summary:focus-visible{outline:2px solid currentColor;outline-offset:3px}
</style><h2 id="title">正在读取数学笔记…</h2><div id="content" hidden><p id="source" class="muted"></p><button id="open" disabled>在 Obsidian 打开原文</button><p id="status" role="status"></p><p id="explanation"></p><div class="panel"><canvas id="plot" aria-label="曲线下面积与左端点矩形近似"></canvas><div class="controls"><select id="function" aria-label="演示函数"></select><button id="play">播放细分</button><button id="reset">重置</button><label>矩形数量 n：<output id="countValue">4</output><input id="count" type="range" min="1" max="100" step="1" value="4"></label></div><div id="values" class="values"></div><small>区间 [0,1]；使用左端点矩形。图形和面积计算在本地运行，不修改笔记。</small></div><details><summary>查看笔记摘录</summary><div id="excerpt"></div></details></div>
<script>
const $=id=>document.getElementById(id),canvas=$('plot'),ctx=canvas.getContext('2d');let data=null,playing=false,last=0,actionsEnabled=false;
function reportSize(){parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{height:document.body.scrollHeight+20}},'*')}
function draw(){if(!data)return;const n=+$('count').value,item=data.functions.find(f=>f.id===$('function').value);if(!item)return;const f=x=>item.id==='quadratic'?x*x:x;
 const width=Math.max(320,canvas.clientWidth),height=280,dpr=devicePixelRatio||1;canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
 const dark=matchMedia('(prefers-color-scheme:dark)').matches,ink=dark?'#ddd':'#555',grid=dark?'#444':'#e7e9ed',left=45,right=width-20,top=20,bottom=245,X=x=>left+(right-left)*x,Y=y=>bottom-(bottom-top)*y;
 ctx.font='12px system-ui';for(let i=0;i<=4;i++){const v=i/4;ctx.strokeStyle=grid;ctx.beginPath();ctx.moveTo(X(v),top);ctx.lineTo(X(v),bottom);ctx.moveTo(left,Y(v));ctx.lineTo(right,Y(v));ctx.stroke();ctx.fillStyle=ink;ctx.fillText(v.toFixed(2),X(v)-10,bottom+20);ctx.fillText(v.toFixed(2),5,Y(v)+4)}
 let sum=0;for(let i=0;i<n;i++){const x=i/n,h=f(x);sum+=h/n;ctx.fillStyle='rgba(60,152,120,.22)';ctx.fillRect(X(x),Y(h),(right-left)/n,bottom-Y(h));ctx.strokeStyle='rgba(60,152,120,.65)';ctx.strokeRect(X(x),Y(h),(right-left)/n,bottom-Y(h))}
 ctx.strokeStyle='#3c9878';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<=300;i++){const x=i/300;if(i)ctx.lineTo(X(x),Y(f(x)));else ctx.moveTo(X(x),Y(f(x)))}ctx.stroke();ctx.lineWidth=1;
 $('countValue').textContent=n;$('values').textContent=item.formula+'    ·    矩形面积和 = '+sum.toFixed(6)+'    ·    误差 = '+Math.abs(item.exact-sum).toFixed(6);
 window.mathState={scene:data.scene,count:n,function:item.id,sum,exact:item.exact,error:Math.abs(item.exact-sum),playing};}
function tick(time){if(playing&&data&&time-last>120){last=time;$('count').value=Math.min(100,+$('count').value+1);if(+$('count').value===100){playing=false;$('play').textContent='播放细分'}draw()}requestAnimationFrame(tick)}
$('play').onclick=()=>{playing=!playing;last=0;if(playing&&+$('count').value===100)$('count').value=1;$('play').textContent=playing?'暂停':'播放细分';draw()};$('reset').onclick=()=>{playing=false;$('count').value=4;$('function').value='linear';$('play').textContent='播放细分';draw()};$('count').oninput=draw;$('function').onchange=draw;
$('open').onclick=()=>{if(!actionsEnabled)return;$('open').disabled=true;$('status').textContent='';parent.postMessage({jsonrpc:'2.0',id:'open-note',method:'dev.jevbot/presentation-action',params:{action:'open-source'}},'*')};
new ResizeObserver(()=>{draw();reportSize()}).observe(document.body);$('excerpt').parentElement.ontoggle=reportSize;requestAnimationFrame(tick);
addEventListener('message',event=>{const m=event.data;if(event.source!==parent||m?.jsonrpc!=='2.0')return;
 if(m.id==='init'&&m.result){parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized'},'*');reportSize()}
 if(m.method==='ui/notifications/host-context-changed'){actionsEnabled=m.params?.presentationActions===true;$('open').disabled=!actionsEnabled}
 if(m.method==='ui/notifications/tool-result'){const d=m.params?.structuredContent?.math;if(d?.scene!=='integral-area')return;data=d;$('title').textContent=d.title+' · 曲线面积';$('source').textContent=d.vault+' / '+d.path;$('explanation').textContent=d.explanation;$('excerpt').innerHTML=d.excerptHTML;if(d.truncated){const tail=document.createElement('p');tail.textContent='…（摘录已截断）';$('excerpt').append(tail)}$('function').replaceChildren(...d.functions.map(f=>{const o=document.createElement('option');o.value=f.id;o.textContent=f.label;return o}));$('content').hidden=false;draw();reportSize()}
 if(m.id==='open-note'){ $('status').textContent=m.error?.message??(m.result?.isError?m.result.message:'');$('open').disabled=!actionsEnabled}
});parent.postMessage({jsonrpc:'2.0',id:'init',method:'ui/initialize',params:{protocolVersion:'2026-01-26',appInfo:{name:'obsidian-math-note',version:'0.1.1'},appCapabilities:{}}},'*');
</script></html>`;
