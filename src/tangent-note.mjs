import { renderNoteMarkdown } from './note-markdown.mjs';
export const tangentNoteURI = 'ui://obsidian/tangent-note';
export const durations = [1800, 2400, 2400, 2400, 1800];
export function tangentNoteData(note) {
  if (typeof note.content !== 'string' || !note.content.includes('正切') || !note.content.includes('\\tan')) return null;
  const headers = [...note.content.matchAll(/^### (Step [1-5][^\n]*)/gm)].map(m => m[1]);
  const formula = note.content.match(/y\s*=\s*([1-9]\d*)\s*\\tan\\left\(x\s*-\s*\\(?:dfrac|frac)\{\\pi\}\{([1-9]\d*)\}\\right\)/);
  const example = headers.length === 5 && headers.every((h,i)=>h.startsWith('Step '+(i+1))) && formula && note.content.includes('对称中心') && /答案[^\n]*C/.test(note.content) && +formula[2] === 3;
  if (headers.length && !example) return null;
  if (!example && !note.content.includes('## 主要性质')) return null;
  const excerpt = example ? note.content.split('## 题目原文')[1]?.split('## 完整解法')[0] : note.content.split('## 主要性质')[1]?.split('## 出现在')[0];
  const text = (excerpt ?? note.content).trim();
  return { scene:'tangent', mode:example?'example':'generic', vault:note.vault, path:note.path,
    title:note.path.split('/').at(-1).replace(/\.md$/,''), parameters:example?{A:+formula[1],omega:1,phi:-Math.PI/+formula[2]}:{A:1,omega:1,phi:0},
    steps:example?headers.map(title=>({title,html:renderNoteMarkdown(title)})):[], answer:example?{choice:'C',minimum:Math.PI/3}:null,
    excerptHTML:renderNoteMarkdown(text.slice(0,4000)),truncated:text.length>4000 };
}
// Shared deterministic math for live playback, capture and offline previews.
export function tangentFrame(data, ms) {
  const durations=[1800,2400,2400,2400,1800],total=durations.reduce((a,b)=>a+b,0);
  const time=Math.max(0,Math.min(total,Number(ms)||0));let start=0,step=0;
  while(step<4&&time>=start+durations[step])start+=durations[step++];
  const t=Math.min(1,(time-start)/durations[step]),ease=t*t*(3-2*t),p=data.parameters;
  return {time,total,step,A:step===0?1:step===1?1+(p.A-1)*ease:p.A,omega:p.omega,phi:step<2?0:step===2?p.phi*ease:p.phi,progress:t};
}
export function tangentSegments(p, xmin=-Math.PI*1.2, xmax=Math.PI*1.6, ymax=5, samples=1000) {
  const segments=[];let segment=[],branch=null;
  for(let i=0;i<=samples;i++){
    const x=xmin+(xmax-xmin)*i/samples,u=p.omega*x+p.phi,b=Math.floor((u+Math.PI/2)/Math.PI),y=p.A*Math.tan(u);
    if(b!==branch||!Number.isFinite(y)||Math.abs(y)>ymax){if(segment.length>1)segments.push(segment);segment=[];}
    branch=b;if(Number.isFinite(y)&&Math.abs(y)<=ymax)segment.push([x,y]);
  }
  if(segment.length>1)segments.push(segment);return segments;
}
export function tangentRuntime() {
  const $=id=>document.getElementById(id),canvas=$('plot'),ctx=canvas.getContext('2d');
  let data=null,time=0,playing=false,epoch=0,startTime=0,free=null,localActions=false,capturing=false;
  const total=10800,starts=[0,1800,4200,6600,9000];
  function size(){if(parent!==window)parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{height:document.body.scrollHeight+20}},'*')}
  function render(){if(!data)return;const frame=tangentFrame(data,time),p=free??frame;
    const w=Math.max(320,canvas.clientWidth),h=320,dpr=window.capture.pixelRatio??devicePixelRatio??1;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const xmin=-Math.PI*1.2,xmax=Math.PI*1.6,ymax=5,left=42,right=w-16,top=18,bottom=h-30;
    const X=x=>left+(x-xmin)/(xmax-xmin)*(right-left),Y=y=>bottom-(y+ymax)/(2*ymax)*(bottom-top);
    ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();ctx.strokeStyle='#d4d8df';ctx.lineWidth=1;
    for(let i=-5;i<=6;i++){const x=i*Math.PI/3;ctx.beginPath();ctx.moveTo(X(x),top);ctx.lineTo(X(x),bottom);ctx.stroke()}
    ctx.strokeStyle='#888';ctx.beginPath();ctx.moveTo(left,Y(0));ctx.lineTo(right,Y(0));ctx.stroke();
    const centers=[];for(let k=-16;k<=16;k++){const x=(k*Math.PI/2-p.phi)/p.omega;if(x<xmin||x>xmax)continue;const asymptote=Math.abs(k%2)===1;centers.push({k,x,kind:asymptote?'asymptote':'zero'});
      if(asymptote){ctx.strokeStyle='#d76b6b';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(X(x),top);ctx.lineTo(X(x),bottom);ctx.stroke();ctx.setLineDash([])}}
    ctx.strokeStyle='#496acb';ctx.lineWidth=2;const segments=tangentSegments(p,xmin,xmax,ymax);
    for(const segment of segments){ctx.beginPath();segment.forEach(([x,y],i)=>i?ctx.lineTo(X(x),Y(y)):ctx.moveTo(X(x),Y(y)));ctx.stroke()}
    for(const c of centers){ctx.fillStyle=c.kind==='zero'?'#33976f':'#d45252';ctx.beginPath();ctx.arc(X(c.x),Y(0),4,0,Math.PI*2);ctx.fill()}
    if(data.mode==='example'&&!free&&frame.step===4){ctx.strokeStyle='#d99c21';ctx.lineWidth=3;ctx.beginPath();ctx.arc(X(data.answer.minimum),Y(0),10,0,Math.PI*2);ctx.stroke()}
    ctx.restore();ctx.fillStyle='#727983';ctx.font='12px system-ui';for(let i=-3;i<=4;i++){const x=i*Math.PI/3;ctx.fillText(i===0?'0':i+'π/3',X(x)-12,h-8)}
    const example=data.mode==='example'&&!free;
    $('step').innerHTML=example?data.steps[frame.step].html:'通用模式 · 参数探索';
    $('table').hidden=!example||frame.step<3;$('answer').hidden=!example||frame.step<4;
    $('equation').textContent='y = '+p.A.toFixed(3)+' tan('+p.omega.toFixed(3)+'x '+(p.phi<0?'−':'+')+' '+Math.abs(p.phi/Math.PI).toFixed(3)+'π)';
    if(!free)['A','omega','phi'].forEach(id=>$(id).value=id==='phi'?p.phi/Math.PI:p[id]);
    $('values').textContent='A = '+p.A.toFixed(3)+' · ω = '+p.omega.toFixed(3)+' · φ = '+(p.phi/Math.PI).toFixed(3)+'π · 周期 = '+(Math.PI/p.omega).toFixed(3)+' · 中心 x = (kπ/2 − φ)/ω';
    $('time').value=time;$('play').textContent=playing?'暂停':'播放五步';
    document.querySelectorAll('[data-step]').forEach(b=>b.setAttribute('aria-current',example&&+b.dataset.step===frame.step?'step':'false'));
    window.tangentState={...frame,...p,mode:example?'example':'generic',centers,segments:segments.length,playing};
  }
  function load(d){if(d?.scene!=='tangent')return;data=d;time=0;free=d.mode==='generic'?{...d.parameters}:null;playing=false;
    $('title').textContent=d.title+' · 正切函数';$('source').textContent=d.vault+' / '+d.path;$('excerpt').innerHTML=d.excerptHTML;
    $('steps').replaceChildren(...d.steps.map((s,i)=>{const b=document.createElement('button');b.textContent='Step '+(i+1);b.title=s.title;b.dataset.step=i;b.onclick=()=>{capturing=false;playing=true;free=null;time=starts[i];epoch=performance.now();startTime=time;render()};return b}));
    $('play').hidden=d.mode!=='example';$('time').parentElement.hidden=d.mode!=='example';$('answer').textContent=d.answer?'最小正值 a = π/3 · 答案 '+d.answer.choice:'';
    ['A','omega','phi'].forEach(id=>$(id).value=id==='phi'?d.parameters[id]/Math.PI:d.parameters[id]);
    $('content').hidden=false;render();size();}
  window.capture={pixelRatio:null,seek(ms){capturing=true;playing=false;free=null;time=ms;render();return window.tangentState},configure({width,pixelRatio=1}={}){if(width)document.body.style.width=width+'px';this.pixelRatio=pixelRatio;render();size()},load};
  $('play').onclick=()=>{capturing=false;free=null;if(time>=total)time=0;playing=!playing;epoch=performance.now();startTime=time;render()};
  $('reset').onclick=()=>load(data);$('time').oninput=()=>{playing=false;free=null;time=+$('time').value;render()};
  ['A','omega','phi'].forEach(id=>$(id).oninput=()=>{playing=false;free={A:+$('A').value,omega:+$('omega').value,phi:+$('phi').value*Math.PI};render()});
  $('open').onclick=()=>{if(!localActions)return;$('status').textContent='';parent.postMessage({jsonrpc:'2.0',id:'open-source',method:'dev.jevbot/presentation-action',params:{action:'open-source'}},'*')};
  function tick(now){if(playing&&!capturing){time=Math.min(total,startTime+now-epoch);if(time===total)playing=false;render()}requestAnimationFrame(tick)}requestAnimationFrame(tick);
  new ResizeObserver(()=>{render();size()}).observe(document.body);
  addEventListener('message',e=>{if(e.source!==parent||e.data?.jsonrpc!=='2.0')return;const m=e.data;
    if(m.id==='init'&&m.result)parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized'},'*');
    if(m.method==='ui/notifications/tool-result')load(m.params?.structuredContent?.math);
    if(m.method==='ui/notifications/host-context-changed'){localActions=m.params?.presentationActions===true;$('open').disabled=!localActions}
    if(m.id==='open-source')$('status').textContent=m.error?.message??(m.result?.isError?m.result.message:'');});
  if(window.PREVIEW_DATA)load(window.PREVIEW_DATA);
  if(parent!==window)parent.postMessage({jsonrpc:'2.0',id:'init',method:'ui/initialize',params:{protocolVersion:'2026-01-26',appInfo:{name:'obsidian-tangent-note',version:'0.1.1'},appCapabilities:{}}},'*');
}
export const tangentNoteHTML=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{font:14px system-ui;color-scheme:light dark}body{margin:0;padding:20px;box-sizing:border-box}h2{margin:0 0 8px;font-size:20px}p{line-height:1.7}canvas{display:block;width:100%;height:320px}.panel{border:1px solid #aaa5;border-radius:12px;padding:14px}.controls{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}button{font:inherit;padding:6px 10px;border:1px solid #aaa5;border-radius:7px;cursor:pointer}button[aria-current=step]{outline:2px solid #496acb}label{display:grid;gap:6px}small,#source{color:#77808a}#excerpt{max-height:500px;overflow:auto;line-height:1.8}math{font-size:1.1em}table{border-collapse:collapse;width:100%}td,th{padding:8px;border-bottom:1px solid #aaa4;text-align:left}tr.highlight{background:#d99c2133}#status:empty{display:none}#step p{margin:6px 0}button:disabled{opacity:.5}[hidden]{display:none!important}
#open{display:inline-block;margin:0 0 14px;padding:0;border:0;border-radius:2px;background:transparent;color:#496acb;font:13px/1.6 system-ui;text-decoration:none}#open:hover:not(:disabled){text-decoration:underline}#open:focus-visible{outline:2px solid currentColor;outline-offset:3px}@media(prefers-color-scheme:dark){#open{color:#99b1ff}}
details{margin-top:var(--jevbot-space-block,24px)}details>summary{display:flex;align-items:center;gap:6px;width:fit-content;list-style:none;cursor:pointer;font:13px/1.6 system-ui;color:#747983}details>summary::-webkit-details-marker{display:none}details>summary::before{content:"›";display:inline-block;font:18px/1 system-ui;transition:transform .15s}details[open]>summary::before{transform:rotate(90deg)}details>summary:hover{color:#496acb}details>summary:focus-visible{outline:2px solid currentColor;outline-offset:3px}
</style><h2 id="title">正在读取正切笔记…</h2><div id="content" hidden><p id="source"></p><button id="open" disabled>在 Obsidian 打开原文</button><p id="status" role="status"></p><div class="panel"><div id="step"></div><p id="equation"></p><canvas id="plot" aria-label="正切曲线、零点与渐近线处的两类对称中心"></canvas><small>绿点：零点处的中心 · 红点：渐近线与 x 轴交点处的中心（不在曲线上）</small><div id="steps" class="controls"></div><div class="controls"><button id="play">播放五步</button><button id="reset">重置</button><label>时间<input id="time" type="range" min="0" max="10800" value="0"></label></div><div class="controls"><label>纵向系数 A<input id="A" type="range" min="0.25" max="3" step="0.01"></label><label>频率 ω<input id="omega" type="range" min="0.25" max="3" step="0.01"></label><label>相位 φ / π<input id="phi" type="range" min="-1" max="1" step="0.01"></label></div><p id="values"></p><table id="table" hidden><thead><tr><th>k</th><th>x = kπ/2 + π/3</th><th>a &gt; 0</th></tr></thead><tbody><tr><td>−2</td><td>−2π/3</td><td>否</td></tr><tr><td>−1</td><td>−π/6</td><td>否</td></tr><tr class="highlight"><td>0</td><td>π/3</td><td>最小正值</td></tr><tr><td>1</td><td>5π/6</td><td>是</td></tr><tr><td>2</td><td>4π/3</td><td>是</td></tr></tbody></table><p id="answer" hidden></p></div><details><summary>查看笔记摘录</summary><div id="excerpt"></div></details></div><script>${tangentFrame.toString()}\n${tangentSegments.toString()}\n(${tangentRuntime.toString()})();</script></html>`;
