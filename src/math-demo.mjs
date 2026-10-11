// A packaged, offline MCP App. No note-supplied HTML or scripts are executed.
export const mathDemoURI = 'ui://obsidian/trigonometry';
export const mathDemoHTML = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{color-scheme:light dark;font:14px system-ui;color:#25282c;background:#fff}*{box-sizing:border-box}body{margin:0;padding:20px}h2{font-size:20px;margin:0 0 6px}p{color:#727780;margin:6px 0 16px;line-height:1.6}.panel{border:1px solid #ddd;border-radius:14px;padding:16px}canvas{width:100%;height:280px;display:block}.controls{display:flex;flex-wrap:wrap;gap:18px;align-items:center;margin-top:16px}label{display:grid;gap:7px;min-width:150px;flex:1}input{width:100%;accent-color:#517fd8}button{font:inherit;border:1px solid #ddd;border-radius:8px;padding:8px 16px;background:#f4f5f7;color:inherit;cursor:pointer}.value{font-variant-numeric:tabular-nums}.formula{padding-top:14px;line-height:1.8}small{color:#727780}@media(prefers-color-scheme:dark){:root{background:#23252b;color:#eee}.panel,button{border-color:#484b53}button{background:#32353c}}
</style><h2>单位圆与正弦、余弦</h2><p>圆上点的纵坐标对应正弦，横坐标对应余弦。拖动角度，观察圆上的点与曲线同步移动。</p>
<div class="panel"><canvas id="plot" aria-label="单位圆和正弦余弦曲线"></canvas>
<div class="controls"><button id="play">播放</button><button id="reset">重置</button><label>角度 θ：<output id="angleValue">0°</output><input id="angle" type="range" min="0" max="360" step="1" value="0"></label></div>
<div class="controls"><label>振幅 A：<output id="amplitudeValue">1.0</output><input id="amplitude" type="range" min="0.2" max="2" step="0.1" value="1"></label><label>频率 k：<output id="frequencyValue">1.0</output><input id="frequency" type="range" min="0.5" max="3" step="0.5" value="1"></label><label>相位 φ：<output id="phaseValue">0°</output><input id="phase" type="range" min="-180" max="180" step="1" value="0"></label></div>
<div class="formula value" id="formula"></div><small>绿色：正弦 · 蓝色：余弦。参数变化在本地计算；此演示不读取或修改笔记。</small></div>
<script>
const $=id=>document.getElementById(id),canvas=$('plot'),ctx=canvas.getContext('2d');
let playing=false,last=0,theta=0;const rad=Math.PI/180;
function draw(){
 const width=Math.max(500,canvas.clientWidth),height=280,dpr=devicePixelRatio||1;
 canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
 const dark=matchMedia('(prefers-color-scheme:dark)').matches,ink=dark?'#ddd':'#555',grid=dark?'#444':'#e7e9ed';
 const A=+$('amplitude').value,k=+$('frequency').value,phi=+$('phase').value*rad,t=theta*rad,a=k*t+phi;
 $('angle').value=theta;$('angleValue').textContent=theta.toFixed(0)+'°';$('amplitudeValue').textContent=A.toFixed(1);$('frequencyValue').textContent=k.toFixed(1);$('phaseValue').textContent=$('phase').value+'°';
 $('formula').textContent='y = '+A.toFixed(1)+' sin('+k.toFixed(1)+'θ + '+$('phase').value+'°) = '+(A*Math.sin(a)).toFixed(3)+'    ·    y = '+A.toFixed(1)+' cos('+k.toFixed(1)+'θ + '+$('phase').value+'°) = '+(A*Math.cos(a)).toFixed(3);
 ctx.clearRect(0,0,width,height);const cx=105,cy=135,r=80,left=235,right=width-18,mid=135,scale=48;
 const line=(x,y,X,Y,color)=>{ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.stroke()};
 line(cx-r-12,cy,cx+r+12,cy,grid);line(cx,cy-r-12,cx,cy+r+12,grid);
 ctx.strokeStyle=ink;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
 const px=cx+r*Math.cos(a),py=cy-r*Math.sin(a);line(cx,cy,px,py,ink);line(px,py,px,cy,'#3a9b77');line(cx,cy,px,cy,'#517fd8');
 ctx.fillStyle=ink;ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();ctx.font='12px system-ui';ctx.fillText('单位圆：角度 kθ + φ',25,255);
 for(let n=-2;n<=2;n++){line(left,mid-n*scale,right,mid-n*scale,grid);ctx.fillText(String(n),left-18,mid-n*scale+4)}
 for(let deg=0;deg<=360;deg+=90){const x=left+(right-left)*deg/360;line(x,30,x,235,grid);ctx.fillStyle=ink;ctx.fillText(deg+'°',x-10,255)}
 for(const [fn,color] of [[Math.sin,'#3a9b77'],[Math.cos,'#517fd8']]){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<=360;i++){const x=left+(right-left)*i/360,y=mid-A*fn(k*i*rad+phi)*scale;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.stroke();const x=left+(right-left)*theta/360,y=mid-A*fn(a)*scale;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill()}
 ctx.lineWidth=1;const x=left+(right-left)*theta/360;line(x,30,x,235,ink);
 window.demoState={playing,angle:theta,amplitude:A,frequency:k,phase:+$('phase').value,sine:A*Math.sin(a),cosine:A*Math.cos(a)};
}
function tick(time){if(playing&&last)theta=(theta+Math.min(time-last,100)*0.04)%360;last=time;if(playing)draw();requestAnimationFrame(tick)}
$('play').onclick=()=>{playing=!playing;last=0;$('play').textContent=playing?'暂停':'播放';draw()};
$('angle').oninput=()=>{theta=+$('angle').value;draw()};for(const id of ['amplitude','frequency','phase'])$(id).oninput=draw;
$('reset').onclick=()=>{playing=false;theta=0;$('amplitude').value=1;$('frequency').value=1;$('phase').value=0;$('play').textContent='播放';draw()};
new ResizeObserver(draw).observe(canvas);draw();requestAnimationFrame(tick);
addEventListener('message',event=>{const m=event.data;if(event.source!==parent||m?.jsonrpc!=='2.0')return;if(m.id===1&&m.result){parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized'},'*');parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{height:document.body.scrollHeight+16}},'*')}});
parent.postMessage({jsonrpc:'2.0',id:1,method:'ui/initialize',params:{protocolVersion:'2026-01-26',appInfo:{name:'obsidian-math-demo',version:'0.1.1'},appCapabilities:{}}},'*');
</script></html>`;
