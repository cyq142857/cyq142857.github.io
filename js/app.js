'use strict';
/* =========================================================
 * 函数猎手 · 前端（前后端分离版）
 * 所有计算（函数生成/评分/记录存储）都在后端，这里只负责界面与渲染
 * ========================================================= */
(function(){
/* ================= 基础工具 ================= */
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=v=>{ if(!isFinite(v))return'0'; const r=Math.round(v*100)/100; return String(r); };

/* ================= API ================= */
async function api(path,opts){
  try{
    const res=await fetch(path,opts);
    const ct=res.headers.get('content-type')||'';
    if(ct.includes('application/json'))return await res.json();
    return {ok:false};
  }catch(e){
    toast('无法连接服务器，请先运行 node server/server.js');
    return null;
  }
}
const get=p=>api(p);
const post=(p,b)=>api(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
const del=p=>api(p,{method:'DELETE'});

/* ================= 音效 ================= */
let actx=null,muted=false;
function beep(f,d,type,g){
  if(muted)return;
  try{
    actx=actx||new (window.AudioContext||window.webkitAudioContext)();
    if(actx.state==='suspended')actx.resume();
    const o=actx.createOscillator(),v=actx.createGain();
    o.type=type||'sine';o.frequency.value=f;v.gain.value=g||0.07;
    v.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+(d||0.08));
    o.connect(v);v.connect(actx.destination);o.start();o.stop(actx.currentTime+(d||0.08)+0.02);
  }catch(e){}
}
const sfx={
  place(){beep(660,.07,'sine',.09);beep(990,.06,'triangle',.05);},
  remove(){beep(320,.07,'sine',.08);},
  submit(){[523,659,784].forEach((f,i)=>setTimeout(()=>beep(f,.12,'triangle',.08),i*110));},
  timeout(){beep(220,.3,'sawtooth',.06);setTimeout(()=>beep(180,.35,'sawtooth',.06),220);},
  newRound(){beep(440,.08,'triangle',.06);}
};

/* ================= 常量（显示用） ================= */
const LEVELS={
  easy:{key:'easy',name:'入门',desc:'一次函数'},
  normal:{key:'normal',name:'进阶',desc:'二次 / 绝对值函数'},
  hard:{key:'hard',name:'专家',desc:'三次 / 正弦 / 指数函数'},
  mix:{key:'mix',name:'混合',desc:'全部函数类型'}
};
/* 时间档位：由长到短（与难度点数相互独立，点数仍由难度决定） */
const TIME_TIERS=[
  {key:'rookie',   name:'萌新', time:60},
  {key:'skilled',  name:'熟手', time:40},
  {key:'master',   name:'高手', time:25},
  {key:'challenge',name:'挑战', time:15}
];
const DBG_TPL={
  linear:'2*x+3',quad:'0.5*(x-1)^2-2',abs:'1.2*|x-2|-1',cubic:'0.02*(x-1)^3+2',sine:'2.5*sin(0.6*x+1)+0.5',exp:'2*exp(0.15*x)-3'
};

/* ================= 状态 ================= */
const save={bestRound:0,bestTotal:0};
const state={level:null,func:null,view:{xmin:-10,xmax:10,ymin:-10,ymax:10},points:[],lastRows:[],timeLeft:0,timerId:null,submitted:false,round:0,total:0,hover:null,timeLimit:0,timeTierName:''};
let history=[];
let debugRecords=[];
let currentHistEntry=null;
const dbg={expr:'',valid:false,samples:null,baseView:null,view:{xmin:-10,xmax:10,ymin:-10,ymax:10},points:[],rows:[],score:0,color:'#0d9488',warned:false};

/* ================= 主题 ================= */
let isDark=false;
try{isDark=localStorage.getItem('fn-hunter-theme')==='dark';}catch(e){}
function palette(){
  return isDark
    ?{grid:'#232c3f',axis:'#3a4560',tick:'#47536f',label:'#8b94ab',pointLabel:'#aab3c7',arrow:'#6b7690',hoverLine:'rgba(150,163,190,.4)',hoverBox:'rgba(10,14,24,.78)',msg:'#f87171'}
    :{grid:'#eef0f6',axis:'#c6cbd8',tick:'#aab0bf',label:'#8b91a0',pointLabel:'#5b6472',arrow:'#9aa0b0',hoverLine:'rgba(100,116,139,.45)',hoverBox:'rgba(31,36,48,.72)',msg:'#b91c1c'};
}
function applyTheme(){
  document.documentElement.setAttribute('data-theme',isDark?'dark':'light');
  const t=$('#darkToggle');
  if(t)t.checked=isDark;
  draw();
  if(graphState)drawGraphCurrent();
  drawDebug();
}

/* ================= 绘制（主画布） ================= */
function niceStep(s){ return s<=4?0.5:s<=8?1:2; }
function draw(){
  const c=$('#cv'); if(!c)return;
  const ctx=c.getContext('2d');
  const P=palette();
  const W=c.clientWidth||600,H=c.clientHeight||600;
  const mL=46,mR=16,mT=18,mB=38;
  const pw=W-mL-mR,ph=H-mT-mB;
  const view=state.view;
  const X=x=>mL+(x-view.xmin)/(view.xmax-view.xmin)*pw;
  const Y=y=>mT+ph-(y-view.ymin)/(view.ymax-view.ymin)*ph;
  ctx.clearRect(0,0,W,H);
  ctx.lineWidth=1;
  for(let x=Math.ceil(view.xmin);x<=view.xmax;x+=1){
    ctx.strokeStyle=(x===0)?P.axis:P.grid;
    ctx.beginPath();ctx.moveTo(X(x),mT);ctx.lineTo(X(x),mT+ph);ctx.stroke();
  }
  const sy=niceStep(view.ymax-view.ymin);
  for(let y=Math.ceil(view.ymin/sy)*sy;y<=view.ymax;y+=sy){
    ctx.strokeStyle=(Math.abs(y)<1e-9)?P.axis:P.grid;
    ctx.beginPath();ctx.moveTo(mL,Y(y));ctx.lineTo(mL+pw,Y(y));ctx.stroke();
  }
  ctx.fillStyle=P.arrow;
  ctx.beginPath();const ax=mL+pw,ay=Y(0);
  ctx.moveTo(ax,ay);ctx.lineTo(ax-7,ay-6);ctx.lineTo(ax-7,ay+6);ctx.closePath();ctx.fill();
  const bx=X(0),by=mT;
  ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx-6,by+7);ctx.lineTo(bx+6,by+7);ctx.closePath();ctx.fill();
  ctx.strokeStyle=P.tick;ctx.lineWidth=1;
  ctx.font='11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle=P.label;
  const sx=niceStep(view.xmax-view.xmin);
  for(let x=Math.ceil(view.xmin/sx)*sx;x<=view.xmax+1e-9;x+=sx){
    if(Math.abs(x)<1e-9)continue;
    ctx.beginPath();ctx.moveTo(X(x),mT+ph);ctx.lineTo(X(x),mT+ph+4);ctx.stroke();
    ctx.textAlign='center';ctx.fillText(fmt(x),X(x),mT+ph+15);
  }
  for(let y=Math.ceil(view.ymin/sy)*sy;y<=view.ymax;y+=sy){
    if(Math.abs(y)<1e-9)continue;
    ctx.beginPath();ctx.moveTo(mL-4,Y(y));ctx.lineTo(mL,Y(y));ctx.stroke();
    ctx.textAlign='right';ctx.fillText(fmt(y),mL-8,Y(y)+3.5);
  }
  ctx.textAlign='center';ctx.fillText('O',mL-8,mT+ph+15);
  state.points.forEach(p=>{
    const px=X(p.x),py=Y(p.y);
    ctx.beginPath();ctx.arc(px,py,6,0,Math.PI*2);
    ctx.fillStyle='#f59e0b';ctx.fill();
    ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();
    ctx.fillStyle=P.pointLabel;ctx.font='11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign='center';ctx.fillText('('+fmt(p.x)+', '+fmt(p.y)+')',px,py-12);
  });
  if(state.submitted&&state.func&&state.func.samples){
    ctx.lineWidth=3;ctx.strokeStyle=state.func.color;
    ctx.beginPath();let pen=false;
    state.func.samples.forEach(pt=>{
      const x=pt[0],y=pt[1];
      if(!isFinite(y)||y===null){pen=false;return;}
      const px=X(x),py=Y(y);
      if(py<mT-24||py>mT+ph+24){pen=false;return;}
      if(pen)ctx.lineTo(px,py);else ctx.moveTo(px,py);
      pen=true;
    });
    ctx.stroke();
    ctx.lineWidth=1.6;ctx.strokeStyle='#ef4444';ctx.fillStyle='#ef4444';
    ctx.font='bold 11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    state.lastRows.forEach(r=>{
      const x1=X(r.x),y1=Y(r.y),x2=X(r.bx),y2=Y(r.by);
      ctx.setLineDash([5,4]);
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(x2,y2,3.5,0,Math.PI*2);ctx.fill();
      ctx.textAlign='center';
      ctx.fillText(fmt(r.d)+' 单位',(x1+x2)/2,(y1+y2)/2-6);
    });
  }
  if(!state.submitted&&state.hover){
    const hx=state.hover.px,hy=state.hover.py;
    if(hx>=mL&&hx<=mL+pw&&hy>=mT&&hy<=mT+ph){
      ctx.setLineDash([4,4]);ctx.strokeStyle=P.hoverLine;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(hx,mT);ctx.lineTo(hx,mT+ph);ctx.stroke();
      ctx.beginPath();ctx.moveTo(mL,hy);ctx.lineTo(mL+pw,hy);ctx.stroke();
      ctx.setLineDash([]);
      const x=view.xmin+(hx-mL)/pw*(view.xmax-view.xmin);
      const y=view.ymax-(hy-mT)/ph*(view.ymax-view.ymin);
      const t='('+fmt(x)+', '+fmt(y)+')';
      ctx.font='11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      const w=ctx.measureText(t).width+16;
      ctx.beginPath();
      ctx.moveTo(mL+6+6,mT+6);ctx.arcTo(mL+6+w,mT+6,mL+6+w,mT+6+20,8);
      ctx.arcTo(mL+6+w,mT+6+20,mL+6,mT+6+20,8);
      ctx.arcTo(mL+6,mT+6+20,mL+6,mT+6,8);
      ctx.arcTo(mL+6,mT+6,mL+6+w,mT+6,8);
      ctx.closePath();
      ctx.fillStyle=P.hoverBox;ctx.fill();
      ctx.fillStyle='#fff';ctx.textAlign='left';ctx.fillText(t,mL+6+8,mT+6+14);
    }
  }
}
function fitCanvas(){
  const c=$('#cv');
  const dpr=window.devicePixelRatio||1;
  const w=c.clientWidth||600;
  c.width=Math.round(w*dpr);
  c.height=Math.round(w*dpr);
  c.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
  draw();
}

/* ================= 共享视图工具（缩放/动画） ================= */
let viewAnimId=null;
function stopViewAnim(){
  if(viewAnimId){cancelAnimationFrame(viewAnimId);viewAnimId=null;}
}
function animateViewTo(view,target,dur,cb){
  stopViewAnim();
  const start={xmin:view.xmin,xmax:view.xmax,ymin:view.ymin,ymax:view.ymax};
  let t0=null;
  function frame(t){
    if(!t0)t0=t;
    const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);
    view.xmin=start.xmin+(target.xmin-start.xmin)*e;
    view.xmax=start.xmax+(target.xmax-start.xmax)*e;
    view.ymin=start.ymin+(target.ymin-start.ymin)*e;
    view.ymax=start.ymax+(target.ymax-start.ymax)*e;
    cb(view);
    if(p<1)viewAnimId=requestAnimationFrame(frame);
    else viewAnimId=null;
  }
  viewAnimId=requestAnimationFrame(frame);
}
function zoomView(view,px,py,factor,c){
  const w=c.clientWidth||500;
  const mL=46,mR=16,mT=18,mB=38,pw=w-mL-mR,ph=w-mT-mB;
  const cx=view.xmin+(px-mL)/pw*(view.xmax-view.xmin);
  const cy=view.ymax-(py-mT)/ph*(view.ymax-view.ymin);
  const nx0=cx-(cx-view.xmin)*factor,nx1=cx+(view.xmax-cx)*factor;
  const ny0=cy-(cy-view.ymin)*factor,ny1=cy+(view.ymax-cy)*factor;
  if(nx1-nx0<0.8||nx1-nx0>60||ny1-ny0<0.8||ny1-ny0>60)return false;
  view.xmin=nx0;view.xmax=nx1;view.ymin=ny0;view.ymax=ny1;
  return true;
}

/* ================= 通用图像渲染（历史/调试） ================= */
function drawGraph(c,entry,view){
  if(!c)return;
  const dpr=window.devicePixelRatio||1;
  const w=c.clientWidth||500;
  c.width=Math.round(w*dpr);c.height=Math.round(w*dpr);
  const ctx=c.getContext('2d');
  const P=palette();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const mL=46,mR=16,mT=18,mB=38,pw=w-mL-mR,ph=w-mT-mB;
  if(!view)view=entry.view||{xmin:-10,xmax:10,ymin:-10,ymax:10};
  const X=x=>mL+(x-view.xmin)/(view.xmax-view.xmin)*pw;
  const Y=y=>mT+ph-(y-view.ymin)/(view.ymax-view.ymin)*ph;
  ctx.clearRect(0,0,w,w);
  ctx.lineWidth=1;
  for(let x=Math.ceil(view.xmin);x<=view.xmax;x+=1){
    ctx.strokeStyle=(x===0)?P.axis:P.grid;
    ctx.beginPath();ctx.moveTo(X(x),mT);ctx.lineTo(X(x),mT+ph);ctx.stroke();
  }
  const sy=niceStep(view.ymax-view.ymin);
  for(let y=Math.ceil(view.ymin/sy)*sy;y<=view.ymax;y+=sy){
    ctx.strokeStyle=(Math.abs(y)<1e-9)?P.axis:P.grid;
    ctx.beginPath();ctx.moveTo(mL,Y(y));ctx.lineTo(mL+pw,Y(y));ctx.stroke();
  }
  ctx.fillStyle=P.arrow;
  ctx.beginPath();const ax=mL+pw,ay=Y(0);
  ctx.moveTo(ax,ay);ctx.lineTo(ax-7,ay-6);ctx.lineTo(ax-7,ay+6);ctx.closePath();ctx.fill();
  const bx=X(0),by=mT;
  ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx-6,by+7);ctx.lineTo(bx+6,by+7);ctx.closePath();ctx.fill();
  ctx.strokeStyle=P.tick;ctx.lineWidth=1;
  ctx.font='11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillStyle=P.label;
  const sx=niceStep(view.xmax-view.xmin);
  for(let x=Math.ceil(view.xmin/sx)*sx;x<=view.xmax+1e-9;x+=sx){
    if(Math.abs(x)<1e-9)continue;
    ctx.beginPath();ctx.moveTo(X(x),mT+ph);ctx.lineTo(X(x),mT+ph+4);ctx.stroke();
    ctx.textAlign='center';ctx.fillText(fmt(x),X(x),mT+ph+15);
  }
  for(let y=Math.ceil(view.ymin/sy)*sy;y<=view.ymax;y+=sy){
    if(Math.abs(y)<1e-9)continue;
    ctx.beginPath();ctx.moveTo(mL-4,Y(y));ctx.lineTo(mL,Y(y));ctx.stroke();
    ctx.textAlign='right';ctx.fillText(fmt(y),mL-8,Y(y)+3.5);
  }
  ctx.textAlign='center';ctx.fillText('O',mL-8,mT+ph+15);
  const samples=entry.samples;
  if(!samples||!samples.length){
    ctx.font='13px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle=P.msg;ctx.textAlign='center';
    ctx.fillText('未应用合法函数，暂无曲线',w/2,mT+ph/2);
  }else{
    ctx.lineWidth=3;ctx.strokeStyle=entry.color;
    ctx.beginPath();let pen=false;
    samples.forEach(pt=>{
      const x=pt[0],y=pt[1];
      if(!isFinite(y)||y===null){pen=false;return;}
      const px=X(x),py=Y(y);
      if(py<mT-24||py>mT+ph+24){pen=false;return;}
      if(pen)ctx.lineTo(px,py);else ctx.moveTo(px,py);
      pen=true;
    });
    ctx.stroke();
  }
  (entry.rows||[]).forEach(r=>{
    const px=X(r.x),py=Y(r.y);
    ctx.beginPath();ctx.arc(px,py,6,0,Math.PI*2);
    ctx.fillStyle='#f59e0b';ctx.fill();
    ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();
    ctx.fillStyle=P.pointLabel;ctx.font='11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign='center';ctx.fillText('('+fmt(r.x)+', '+fmt(r.y)+')',px,py-12);
  });
  ctx.lineWidth=1.6;ctx.strokeStyle='#ef4444';ctx.fillStyle='#ef4444';
  ctx.font='bold 11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  (entry.rows||[]).forEach(r=>{
    if(r.bx===undefined&&r.by===undefined)return;
    const x1=X(r.x),y1=Y(r.y),x2=X(r.bx),y2=Y(r.by);
    ctx.setLineDash([5,4]);
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(x2,y2,3.5,0,Math.PI*2);ctx.fill();
    ctx.textAlign='center';
    ctx.fillText(fmt(r.d)+' 单位',(x1+x2)/2,(y1+y2)/2-6);
  });
}

/* ================= 图像弹窗 ================= */
let graphState=null;
function openGraph(entry){
  stopViewAnim();
  graphState={entry:entry,view:Object.assign({},entry.view||{xmin:-10,xmax:10,ymin:-10,ymax:10})};
  if(entry.expr){
    $('#gRound').textContent=timeStr(entry.ts);
    $('#gFormula').textContent=entry.expr;
  }else{
    $('#gRound').textContent=entry.round||0;
    $('#gFormula').textContent=entry.formula||'';
  }
  $('#gSwatch').style.background=entry.color||'#4f46e5';
  $('#graphDlg').classList.remove('hide');
  drawGraphCurrent();
  updateZoomLabel();
}
function drawGraphCurrent(){
  if(!graphState)return;
  drawGraph($('#graphCanvas'),graphState.entry,graphState.view);
}
function updateZoomLabel(){
  if(!graphState)return;
  const base=graphState.entry.view||{xmin:-10,xmax:10};
  const z=(base.xmax-base.xmin)/(graphState.view.xmax-graphState.view.xmin);
  $('#gZoom').textContent='×'+z.toFixed(2);
}

/* ================= 主画布交互 ================= */
function bindCanvas(){
  const c=$('#cv');
  c.addEventListener('click',e=>{
    if(state.submitted||!state.level)return;
    const r=c.getBoundingClientRect();
    const px=e.clientX-r.left,py=e.clientY-r.top;
    const view=state.view;
    const mL=46,mR=16,mT=18,mB=38;
    const pw=(c.clientWidth||600)-mL-mR,ph=(c.clientHeight||600)-mT-mB;
    const X=x=>mL+(x-view.xmin)/(view.xmax-view.xmin)*pw;
    const Y=y=>mT+ph-(y-view.ymin)/(view.ymax-view.ymin)*ph;
    if(px<mL||px>mL+pw||py<mT||py>mT+ph)return;
    const x=view.xmin+(px-mL)/pw*(view.xmax-view.xmin);
    const y=view.ymax-(py-mT)/ph*(view.ymax-view.ymin);
    const hit=state.points.findIndex(p=>Math.hypot(X(p.x)-px,Y(p.y)-py)<13);
    if(hit>=0){ state.points.splice(hit,1); sfx.remove(); }
    else{
      if(state.points.length>=state.level.quota){
        toast('点数已达上限，可点「重试本局」重新开始');
        sfx.remove(); updateHUD(); draw(); return;
      }
      state.points.push({x,y}); sfx.place();
      if(state.points.length===state.level.quota){
        toast('点数已集齐，1.2 秒后自动判定…');
        setTimeout(()=>{ if(!state.submitted&&state.points.length===state.level.quota) evaluate('full'); },1200);
      }
    }
    updateHUD(); draw();
  });
  let raf=null;
  c.addEventListener('mousemove',e=>{
    if(state.submitted)return;
    const r=c.getBoundingClientRect();
    state.hover={px:e.clientX-r.left,py:e.clientY-r.top};
    if(!raf){ raf=requestAnimationFrame(()=>{ raf=null; draw(); }); }
  });
  c.addEventListener('mouseleave',()=>{ state.hover=null; draw(); });
}

/* ================= 流程 ================= */
function startTimer(){
  clearInterval(state.timerId);
  state.timerId=setInterval(()=>{
    state.timeLeft=Math.max(0,state.timeLeft-0.1);
    if(state.timeLeft<=0&&!state.submitted){ state.timeLeft=0; evaluate('timeout'); }
    else updateHUD();
  },100);
}
async function newRound(){
  const r=await get('/api/game/new?level='+(state.level?state.level.key:'easy'));
  if(!r||!r.ok||!r.func){ toast('获取新函数失败'); return; }
  state.round++;
  state.func=r.func;
  state.view=state.func.view;
  state.points=[];state.lastRows=[];state.submitted=false;
  if(state.level){
    state.level.quota=r.func.quota;
  }
  state.timeLeft=state.timeLimit;
  startTimer();
  sfx.newRound();
  $('#fbFormula').textContent=state.func.label;
  $('#fbDot').style.background=state.func.color;
  $('#formulaBanner').classList.remove('hide');
  updateHUD(); draw();
}
function retryRound(){
  state.points=[];state.lastRows=[];state.submitted=false;
  state.timeLeft=state.timeLimit;
  startTimer();
  updateHUD(); draw();
}
function exitToHome(){
  clearInterval(state.timerId);
  state.level=null;state.func=null;state.points=[];state.lastRows=[];state.submitted=false;state.hover=null;
  state.view={xmin:-10,xmax:10,ymin:-10,ymax:10};
  $('#formulaBanner').classList.add('hide');
  $('#result').classList.add('hide');
  $('#gameView').classList.add('hide');
  $('#homeView').classList.remove('hide');
  updateHUD(); draw();
  renderHistory();
  toast('已退出本局，本关进度未保存');
}
async function start(levelKey, timeKey){
  state.level=LEVELS[levelKey];
  const tier=TIME_TIERS.find(t=>t.key===timeKey)||TIME_TIERS[1];
  state.timeLimit=tier.time; state.timeTierName=tier.name;
  $('#homeView').classList.add('hide');
  $('#gameView').classList.remove('hide');
  $('#result').classList.add('hide');
  $('#debugBar').classList.add('hide');
  await newRound();
  setTimeout(fitCanvas,0);
}
let pendingLevel=null;
function chooseTime(levelKey){
  if(state.level&&!state.submitted)clearInterval(state.timerId); // 弹窗期间暂停当前对局计时，避免误超时
  pendingLevel=levelKey;
  $('#timeDlgLevel').textContent=LEVELS[levelKey].name;
  const grid=$('#tierGrid'); grid.innerHTML='';
  TIME_TIERS.forEach(t=>{
    const b=document.createElement('button');
    b.className='tier-btn';
    b.innerHTML='<span class="tn">'+t.name+'</span><span class="ts">'+t.time+'s</span>';
    b.addEventListener('click',()=>{ $('#timeDlg').classList.add('hide'); start(pendingLevel,t.key); });
    grid.appendChild(b);
  });
  $('#timeDlg').classList.remove('hide');
}
function closeTimeDlg(){
  $('#timeDlg').classList.add('hide');
  if(state.level&&!state.submitted)startTimer(); // 取消则继续当前对局
}
async function evaluate(reason){
  if(state.submitted||!state.func||!state.level)return;
  state.submitted=true; clearInterval(state.timerId);
  const res=await post('/api/game/evaluate',{
    func:{family:state.func.family,params:state.func.params},
    points:state.points,
    quota:state.level.quota,
    timeLeft:Math.round(state.timeLeft*10)/10,
    timeTotal:state.timeLimit
  });
  if(!res||!res.ok){ state.submitted=false; startTimer(); toast('评分失败，请重试'); return; }
  const {rows,bonus,score}=res;
  state.lastRows=rows;
  state.total=Math.round((state.total+score)*10)/10;
  if(score>save.bestRound)save.bestRound=score;
  if(state.total>save.bestTotal)save.bestTotal=state.total;
  await post('/api/save',{bestRound:save.bestRound,bestTotal:save.bestTotal});
  const entry={
    ts:Date.now(),round:state.round,levelKey:state.level.key,levelName:state.level.name,
    formula:state.func.label,color:state.func.color,type:state.func.type,
    family:state.func.family,params:state.func.params,view:state.func.view,samples:state.func.samples,
    score:score,bonus:bonus,reason:reason,
    timeLeft:Math.round(state.timeLeft*10)/10,timeTotal:state.timeLimit,rows:rows
  };
  await post('/api/history',{entry:entry});
  if(reason==='timeout')sfx.timeout(); else sfx.submit();
  updateHUD(); draw();
  toast('正在坐标系展示真实曲线…');
  const fRef=state.func;
  setTimeout(()=>{
    if(state.func===fRef&&state.submitted){
      showResult({score:score,rows:rows,bonus:bonus,reason:reason,formula:fRef.label,color:fRef.color,round:state.round,levelName:state.level.name,timeLeft:state.timeLeft},'play');
    }
  },1000);
}

/* ================= 结果弹窗 ================= */
function showResult(d,mode){
  const isHist=(mode==='history');
  $('#rTitle').textContent=isHist?('历史对局 · 第 '+d.round+' 局'):((d.reason==='timeout')?'⏰ 时间到！':'🎯 判定完成');
  $('#rRound').textContent=isHist?('难度 '+d.levelName+' · 历史记录'):('第 '+d.round+' 局 · 难度 '+d.levelName);
  $('#rFormula').textContent=d.formula;
  $('#rSwatch').style.background=d.color;
  $('#rPerfect').classList.toggle('hide',d.score<99.5);
  $('#rBonus').textContent='时间奖励：+'+fmt(d.bonus)+' 分（剩余 '+Math.ceil(d.timeLeft)+'s）';
  let h='<table class="rows"><tr><th>点</th><th>你点的坐标</th><th>最近距离</th><th>垂直误差</th><th>得分</th></tr>';
  d.rows.forEach((r,i)=>{
    const badge= r.d<0.25?'完美':r.d<0.75?'优秀':r.d<1.5?'不错':r.d<2.6?'偏差':'太远';
    const bc= r.d<0.25?'b-perfect':r.d<0.75?'b-good':r.d<1.5?'b-ok':r.d<2.6?'b-far':'b-out';
    h+='<tr><td>#'+(i+1)+'</td><td>('+fmt(r.x)+', '+fmt(r.y)+')</td><td>'+fmt(r.d)+' 单位</td><td>'+fmt(r.vert)+' 单位</td><td><span class="badge '+bc+'">'+badge+'</span> '+fmt(r.score)+' / '+fmt(r.max)+'</td></tr>';
  });
  h+='</table>';
  $('#rTableWrap').innerHTML=h;
  $('#rSum').innerHTML='<span>本局得分</span><span style="color:var(--accent)">'+fmt(d.score)+' / 100</span>';
  const bar=$('#ringBar'),C=2*Math.PI*52,num=$('#rNum');
  bar.style.strokeDashoffset=String(C);num.textContent='0';
  let t0=null;
  function step(t){
    if(!t0)t0=t;
    const p=Math.min(1,(t-t0)/900);
    const e=1-Math.pow(1-p,3);
    num.textContent=fmt(d.score*e);
    bar.style.strokeDashoffset=String(C*(1-d.score/100*e));
    if(p<1)requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  $('#retryBtn2').classList.toggle('hide',isHist);
  $('#nextBtn').classList.toggle('hide',isHist);
  $('#histGraphBtn').classList.toggle('hide',!isHist);
  $('#histCloseBtn').classList.toggle('hide',!isHist);
  $('#menuBtn').classList.toggle('hide',isHist);
  $('#result').classList.remove('hide');
}

/* ================= 历史记录 ================= */
function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function rating(score){
  if(score>=99.5)return{label:'完美',cls:'b-perfect'};
  if(score>=85)return{label:'优秀',cls:'b-good'};
  if(score>=70)return{label:'良好',cls:'b-ok'};
  if(score>=50)return{label:'及格',cls:'b-far'};
  return{label:'继续努力',cls:'b-out'};
}
function timeStr(ts){
  const d=new Date(ts);
  const p=n=>String(n).padStart(2,'0');
  return (d.getMonth()+1)+'-'+d.getDate()+' '+p(d.getHours())+':'+p(d.getMinutes());
}
async function renderHistory(){
  const r=await get('/api/history');
  if(!r||!r.ok)return;
  history=r.list||[];
  const n=history.length;
  $('#histCount').textContent=n;
  const avg=n?Math.round(history.reduce((a,h)=>a+h.score,0)/n*10)/10:0;
  const mx=n?Math.max.apply(null,history.map(h=>h.score)):0;
  const full=n?history.filter(h=>h.score>=99.5).length:0;
  $('#histStats').innerHTML=
    '<div class="chip">场次 <b>'+n+'</b></div>'+
    '<div class="chip">平均分 <b>'+fmt(avg)+'</b></div>'+
    '<div class="chip">最高分 <b>'+fmt(mx)+'</b></div>'+
    '<div class="chip">满分次数 <b>'+full+'</b></div>';
  const list=$('#histList');
  if(!n){ list.innerHTML='<div class="empty">还没有对局记录，先去开始游戏玩一局吧！</div>'; return; }
  list.innerHTML=history.map((h,i)=>{
    const r=rating(h.score);
    return '<div class="hrow">'+
      '<div class="hscore"><b>'+fmt(h.score)+'</b><span>分</span></div>'+
      '<div class="hmain"><div class="hformula"><i style="background:'+h.color+'"></i>'+escapeHtml(h.formula)+'</div>'+
      '<div class="hmeta">'+h.levelName+' · '+h.type+' · 剩余 '+Math.ceil(h.timeLeft)+'s/'+h.timeTotal+'s · '+timeStr(h.ts)+'</div></div>'+
      '<div><span class="badge '+r.cls+'">'+r.label+'</span></div>'+
      '<div class="hbtns"><button class="hbtn" data-i="'+i+'" data-act="detail">详情</button><button class="hbtn" data-i="'+i+'" data-act="replay">重玩</button></div>'+
    '</div>';
  }).join('');
}
async function replayRecipe(recipe){
  state.level=LEVELS[recipe.levelKey]||LEVELS.easy;
  state.round++;
  state.func={
    label:recipe.formula,color:recipe.color,type:recipe.type,
    family:recipe.family,params:recipe.params,view:recipe.view,samples:recipe.samples,
    quota:recipe.rows?recipe.rows.length:1,time:recipe.timeTotal||30
  };
  state.level.quota=state.func.quota;
  state.view=state.func.view;
  state.points=[];state.lastRows=[];state.submitted=false;
  state.timeLimit=state.func.time; state.timeTierName='历史';
  state.timeLeft=state.timeLimit;
  startTimer();
  sfx.newRound();
  $('#fbFormula').textContent=state.func.label;
  $('#fbDot').style.background=state.func.color;
  $('#formulaBanner').classList.remove('hide');
  $('#homeView').classList.add('hide');
  $('#gameView').classList.remove('hide');
  $('#result').classList.add('hide');
  $('#debugBar').classList.add('hide');
  setTimeout(fitCanvas,0);
  updateHUD(); draw();
}

/* ================= 调试模式 ================= */
async function applyDebugExpr(){
  const raw=$('#dbgInput').value;
  const r=await post('/api/debug/apply',{expr:raw});
  if(!r||!r.ok){ toast('无法连接服务器'); return; }
  if(!r.valid){
    dbg.valid=false;dbg.samples=null;dbg.rows=[];dbg.score=0;
    $('#dbgInput').classList.add('invalid');
    updateDbgPanel();drawDebug();
    toast('函数不合法，未显示曲线（已放置的点保留）');
    return;
  }
  dbg.valid=true;dbg.expr=raw.trim();dbg.samples=r.samples;dbg.warned=false;
  dbg.baseView=r.view;
  dbg.view=Object.assign({},r.view);
  $('#dbgInput').classList.remove('invalid');
  await evaluateDebugPoints();
  updateDbgPanel();drawDebug();
}
async function evaluateDebugPoints(){
  if(!dbg.valid)return;
  const r=await post('/api/debug/evaluate',{expr:dbg.expr,points:dbg.points});
  if(!r||!r.ok)return;
  if(r.valid){ dbg.rows=r.rows; dbg.score=r.score; }
  updateDbgPanel();drawDebug();
}
function randomDbgExpr(){
  const fams=Object.keys(DBG_TPL);
  const fam=fams[Math.floor(Math.random()*fams.length)];
  const r=(a,b)=>a+Math.random()*(b-a),sg=()=>Math.random()<0.5?-1:1,f=v=>Math.round(v*100)/100;
  const sgn=v=>v>=0?'+'+f(v):'-'+f(Math.abs(v));
  let e;
  if(fam==='linear')e=f(sg()*r(0.3,1.5))+'*x'+sgn(r(-4,4));
  else if(fam==='quad')e=f(sg()*r(0.3,1.2))+'*(x'+(sg()>0?'-':'+')+f(r(0.5,5))+')^2'+sgn(r(-5,5));
  else if(fam==='abs')e=f(sg()*r(0.6,1.4))+'*|x'+(sg()>0?'-':'+')+f(r(0.5,4))+'|'+sgn(r(-5,5));
  else if(fam==='cubic')e=f(sg()*r(0.006,0.02))+'*(x'+(sg()>0?'-':'+')+f(r(0.5,2))+')^3'+sgn(r(-4,4));
  else if(fam==='sine')e=f(r(1.5,3.5))+'*sin('+f(r(0.35,1))+'*x+'+f(r(0,6))+')'+sgn(r(-3,3));
  else e=f(sg()*r(1,3))+'*exp('+f(sg()*r(0.08,0.2))+'*x)'+sgn(r(-4,4));
  return e;
}
function drawDebug(){
  const c=$('#dbgCanvas');
  if(!c)return;
  drawGraph(c,{samples:dbg.samples,color:dbg.color,rows:dbg.rows},dbg.view);
}
function updateDbgPanel(){
  const st=$('#dbgStatus');
  if(dbg.valid){ st.textContent='已应用：'+dbg.expr; st.className='dbg-status ok'; }
  else{ st.textContent='尚未应用合法函数'; st.className='dbg-status err'; }
  $('#dbgExpr').textContent=dbg.valid?dbg.expr:'（尚未应用合法函数）';
  const pts=$('#dbgPoints');
  if(!dbg.points.length){
    pts.innerHTML='<span style="color:var(--sub)">点击左侧图像放置点</span>';
    $('#dbgScore').textContent='—';
  }else if(!dbg.valid){
    pts.innerHTML=dbg.points.map((p,i)=>'<div>#'+(i+1)+' ('+fmt(p.x)+', '+fmt(p.y)+') 距离 —</div>').join('');
    $('#dbgScore').textContent='—';
  }else{
    pts.innerHTML=dbg.rows.map((e,i)=>'<div>#'+(i+1)+' ('+fmt(e.x)+', '+fmt(e.y)+') 距离 '+fmt(e.d)+' → <b>'+fmt(e.score)+'</b> 分</div>').join('');
    $('#dbgScore').textContent=fmt(dbg.score)+' / 100';
  }
}
async function saveDebugRecord(){
  if(!dbg.valid){ toast('请先应用一个合法函数'); return; }
  if(!dbg.points.length){ toast('请先在图像上放置至少一个点'); return; }
  const entry={
    ts:Date.now(),expr:dbg.expr,color:dbg.color,
    view:Object.assign({},dbg.baseView),samples:dbg.samples,rows:dbg.rows,score:dbg.score
  };
  const r=await post('/api/debug',{entry:entry});
  if(!r||!r.ok)return;
  debugRecords=r.list||[];
  updateDbgCount();
  toast('已保存本次调试记录');
}
async function updateDbgCount(){
  const r=await get('/api/debug');
  if(r&&r.ok){ debugRecords=r.list||[]; $('#dbgCount').textContent=debugRecords.length; }
}
async function renderDbgList(){
  const r=await get('/api/debug');
  if(!r||!r.ok)return;
  debugRecords=r.list||[];
  const list=$('#dbgList');
  if(!debugRecords.length){
    list.innerHTML='<div class="empty">还没有调试记录，输入函数并放置点后点「保存本次调试」</div>';
    return;
  }
  list.innerHTML=debugRecords.map((h,i)=>{
    const r=rating(h.score);
    return '<div class="hrow">'+
      '<div class="hscore"><b>'+fmt(h.score)+'</b><span>分</span></div>'+
      '<div class="hmain"><div class="hformula"><i style="background:'+h.color+'"></i>'+escapeHtml(h.expr)+'</div>'+
      '<div class="hmeta">'+(h.rows?h.rows.length:0)+' 个点 · '+timeStr(h.ts)+'</div></div>'+
      '<div><span class="badge '+r.cls+'">'+r.label+'</span></div>'+
      '<div class="hbtns"><button class="hbtn" data-i="'+i+'" data-act="view">查看</button><button class="hbtn" data-i="'+i+'" data-act="del">删除</button></div>'+
    '</div>';
  }).join('');
}
function toggleDebug(){
  const bar=$('#debugBar');
  if(bar.classList.contains('hide')){
    if($('#homeView').classList.contains('hide')){
      toast('调试模式仅可在主页面打开');
      return;
    }
    bar.classList.remove('hide');
    $('#homeView').classList.add('hide');
    updateDbgPanel();
    drawDebug();
  }else{
    bar.classList.add('hide');
    $('#homeView').classList.remove('hide');
  }
}
document.addEventListener('keydown',e=>{
  if(e.ctrlKey&&e.shiftKey&&(e.key==='D'||e.key==='d')){
    e.preventDefault();
    toggleDebug();
  }
});

/* ================= HUD ================= */
function updateHUD(){
  $('#statRound').textContent=state.round;
  $('#statTotal').textContent=fmt(state.total);
  $('#statBest').textContent=fmt(save.bestRound);
  $('#hintLevel').textContent=state.level?(state.level.name+(state.timeTierName?(' · '+state.timeTierName):'')):'—';
  $('#hintType').textContent=state.func?state.func.type:'—';
  const t=Math.max(0,Math.ceil(state.timeLeft));
  const tv=$('#timeVal');
  tv.textContent=state.level?(t+'s'):'—';
  tv.classList.toggle('low',!!state.level&&t<=5);
  const tb=$('#timeBar');
  tb.style.width=state.level?(state.timeLeft/state.timeLimit*100)+'%':'0%';
  tb.style.background=t<=5?'var(--red)':t<=10?'var(--amber)':'var(--accent)';
  const dots=$('#dots');
  if(state.level){
    const n=state.points.length,q=state.level.quota;
    dots.innerHTML=('<span class="on">●</span>'.repeat(n))+('<span class="off">○</span>'.repeat(q-n))+' <span style="font-size:12px;color:var(--sub);letter-spacing:0">'+n+' / '+q+'</span>';
  }else dots.textContent='—';
  $('#undoBtn').disabled=!state.points.length||state.submitted;
  $('#retryBtn').disabled=state.submitted;
  $('#submitBtn').disabled=!state.points.length||state.submitted;
  $('#exitBtn').disabled=!state.level||state.submitted;
  document.querySelectorAll('.lvl[data-l]').forEach(b=>b.classList.toggle('active',!!state.level&&b.dataset.l===state.level.key));
}

/* ================= Toast ================= */
let toastTimer=null;
function toast(msg){
  const el=$('#toast');
  el.textContent=msg;el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),1800);
}

/* ================= 事件绑定 / 初始化 ================= */
const mg=$('#mgrid');
mg.innerHTML=Object.keys(LEVELS).map(k=>{
  const L=LEVELS[k];
  return '<div class="mcard" data-l="'+k+'"><h4>'+L.name+'</h4><p>'+L.desc+'</p><span class="tag">'+L.tag+'</span></div>';
}).join('');
/* 菜单卡片补充点数/时长说明 */
Object.keys(LEVELS).forEach(k=>{
  const el=mg.querySelector('[data-l="'+k+'"] .tag');
  if(el){
  const q={easy:2,normal:3,hard:4,mix:4}[k];
  el.textContent='点 '+q+' 个 · 时间自选';
  }
});
mg.addEventListener('click',e=>{
  const card=e.target.closest('.mcard');
  if(card)chooseTime(card.dataset.l);
});
document.querySelectorAll('.lvl[data-l]').forEach(b=>{
  b.addEventListener('click',()=>{ chooseTime(b.dataset.l); });
});
$('#timeCancel').addEventListener('click',closeTimeDlg);
$('#timeDlg').addEventListener('click',e=>{ if(e.target===$('#timeDlg'))closeTimeDlg(); });
$('#muteBtn').addEventListener('click',()=>{
  muted=!muted;
  $('#muteBtn').textContent=muted?'🔇':'🔊';
});
$('#undoBtn').addEventListener('click',()=>{
  if(!state.points.length||state.submitted)return;
  state.points.pop();sfx.remove();updateHUD();draw();
});
$('#retryBtn').addEventListener('click',()=>{ if(!state.submitted)retryRound(); });
$('#submitBtn').addEventListener('click',()=>{
  if(!state.points.length){ toast('请先放置至少一个点'); return; }
  evaluate('submit');
});
$('#exitBtn').addEventListener('click',()=>{
  if(!state.level||state.submitted)return;
  clearInterval(state.timerId);
  $('#confirmDlg').classList.remove('hide');
});
$('#confirmNo').addEventListener('click',()=>{ $('#confirmDlg').classList.add('hide'); startTimer(); });
$('#confirmYes').addEventListener('click',()=>{ $('#confirmDlg').classList.add('hide'); exitToHome(); });
$('#confirmDlg').addEventListener('click',e=>{
  if(e.target===$('#confirmDlg')){ $('#confirmDlg').classList.add('hide'); startTimer(); }
});
$('#menuBtn').addEventListener('click',()=>{
  clearInterval(state.timerId);
  $('#result').classList.add('hide');
  $('#gameView').classList.add('hide');
  $('#homeView').classList.remove('hide');
  renderHistory();
});
document.querySelectorAll('.tab').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    $('#tabPlay').classList.toggle('hide',b.dataset.tab!=='play');
    $('#tabHistory').classList.toggle('hide',b.dataset.tab!=='history');
    $('#tabSettings').classList.toggle('hide',b.dataset.tab!=='settings');
    if(b.dataset.tab==='history')renderHistory();
  });
});
$('#darkToggle').addEventListener('change',()=>{
  isDark=$('#darkToggle').checked;
  try{localStorage.setItem('fn-hunter-theme',isDark?'dark':'light');}catch(e){}
  applyTheme();
});
$('#histCloseBtn').addEventListener('click',()=>{ $('#result').classList.add('hide'); });
$('#histGraphBtn').addEventListener('click',()=>{
  if(!currentHistEntry)return;
  openGraph(currentHistEntry);
});
$('#graphCloseBtn').addEventListener('click',()=>{ stopViewAnim(); $('#graphDlg').classList.add('hide'); });
$('#graphDlg').addEventListener('click',e=>{ if(e.target===$('#graphDlg')){ stopViewAnim(); $('#graphDlg').classList.add('hide'); } });
$('#gResetBtn').addEventListener('click',()=>{
  if(!graphState)return;
  const base=graphState.entry.view||{xmin:-10,xmax:10,ymin:-10,ymax:10};
  animateViewTo(graphState.view,base,450,()=>{ updateZoomLabel(); drawGraphCurrent(); });
});
$('#graphCanvas').addEventListener('wheel',e=>{
  if(!graphState)return;
  e.preventDefault();
  stopViewAnim();
  const r=$('#graphCanvas').getBoundingClientRect();
  if(zoomView(graphState.view,e.clientX-r.left,e.clientY-r.top,e.deltaY>0?1.15:1/1.15,$('#graphCanvas'))){
    updateZoomLabel();
    drawGraphCurrent();
  }
},{passive:false});
$('#clearHistBtn').addEventListener('click',async ()=>{
  if(!history.length){ toast('暂无历史记录'); return; }
  if(confirm('确定清空全部 '+history.length+' 条历史记录吗？此操作不可恢复。')){
    await post('/api/history/clear');
    await renderHistory();
    toast('历史记录已清空');
  }
});
$('#exportBtn').addEventListener('click',async ()=>{
  if(!history.length){ toast('暂无历史记录可导出'); return; }
  const res=await fetch('/api/history/export');
  const blob=await res.blob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='function-hunter-history-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},300);
  toast('已导出 '+history.length+' 条记录');
});
$('#importBtn').addEventListener('click',()=>{ $('#importFile').click(); });
$('#importFile').addEventListener('change',async e=>{
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=async ()=>{
    try{
      const list=JSON.parse(reader.result);
      if(!Array.isArray(list))throw new Error('bad');
      const r=await post('/api/history/import',{list:list});
      if(!r||!r.ok)throw new Error('api');
      await renderHistory();
      toast('成功导入 '+r.count+' 条记录，当前共 '+history.length+' 条');
    }catch(err){
      toast('导入失败：文件格式不正确');
    }
  };
  reader.readAsText(file);
  e.target.value='';
});
$('#histList').addEventListener('click',e=>{
  const b=e.target.closest('.hbtn');
  if(!b)return;
  const h=history[Number(b.dataset.i)];
  if(!h)return;
  if(b.dataset.act==='replay'){
    replayRecipe(h);
  }else{
    currentHistEntry=h;
    showResult({score:h.score,rows:h.rows,bonus:h.bonus,reason:h.reason,formula:h.formula,color:h.color,round:h.round,levelName:h.levelName,timeLeft:h.timeLeft},'history');
  }
});
/* ---- 调试 ---- */
$('#dbgExitBtn').addEventListener('click',toggleDebug);
$('#dbgApplyBtn').addEventListener('click',applyDebugExpr);
$('#dbgInput').addEventListener('keydown',e=>{ if(e.key==='Enter')applyDebugExpr(); });
$('#dbgRandomBtn').addEventListener('click',()=>{ $('#dbgInput').value=randomDbgExpr(); applyDebugExpr(); });
document.querySelectorAll('[data-tpl]').forEach(b=>{
  b.addEventListener('click',()=>{ $('#dbgInput').value=DBG_TPL[b.dataset.tpl]; applyDebugExpr(); });
});
$('#dbgSaveBtn').addEventListener('click',saveDebugRecord);
$('#dbgListBtn').addEventListener('click',async ()=>{ await renderDbgList(); $('#dbgListDlg').classList.remove('hide'); });
$('#dbgListClose').addEventListener('click',()=>{ $('#dbgListDlg').classList.add('hide'); });
$('#dbgListDlg').addEventListener('click',e=>{ if(e.target===$('#dbgListDlg'))$('#dbgListDlg').classList.add('hide'); });
$('#dbgList').addEventListener('click',async e=>{
  const b=e.target.closest('.hbtn');
  if(!b)return;
  const rec=debugRecords[Number(b.dataset.i)];
  if(!rec)return;
  if(b.dataset.act==='view'){ $('#dbgListDlg').classList.add('hide'); openGraph(rec); }
  else if(b.dataset.act==='del'){
    await del('/api/debug/delete?ts='+rec.ts);
    await updateDbgCount();
    await renderDbgList();
    toast('已删除该调试记录');
  }
});
$('#dbgClearBtn').addEventListener('click',async ()=>{
  if(!debugRecords.length){ toast('暂无调试记录'); return; }
  if(confirm('确定清空全部 '+debugRecords.length+' 条调试记录吗？此操作不可恢复。')){
    await post('/api/debug/clear');
    await updateDbgCount();
    await renderDbgList();
    toast('调试记录已清空');
  }
});
$('#dbgExportBtn').addEventListener('click',async ()=>{
  if(!debugRecords.length){ toast('暂无调试记录可导出'); return; }
  const res=await fetch('/api/debug/export');
  const blob=await res.blob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='function-hunter-debug-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},300);
  toast('已导出 '+debugRecords.length+' 条调试记录');
});
$('#dbgImportBtn').addEventListener('click',()=>{ $('#dbgImportFile').click(); });
$('#dbgImportFile').addEventListener('change',async e=>{
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=async ()=>{
    try{
      const list=JSON.parse(reader.result);
      if(!Array.isArray(list))throw new Error('bad');
      const r=await post('/api/debug/import',{list:list});
      if(!r||!r.ok)throw new Error('api');
      await updateDbgCount();
      await renderDbgList();
      toast('成功导入 '+r.count+' 条调试记录，当前共 '+debugRecords.length+' 条');
    }catch(err){
      toast('导入失败：文件格式不正确');
    }
  };
  reader.readAsText(file);
  e.target.value='';
});
$('#dbgResetBtn').addEventListener('click',()=>{
  if(!dbg.valid||!dbg.baseView)return;
  const base=Object.assign({},dbg.baseView);
  animateViewTo(dbg.view,base,450,()=>{
    $('#dbgZoom').textContent='×'+((dbg.baseView.xmax-dbg.baseView.xmin)/(dbg.view.xmax-dbg.view.xmin)).toFixed(2);
    drawDebug();
  });
});
$('#dbgClearPtsBtn').addEventListener('click',()=>{
  if(!dbg.points.length){ toast('画布上没有点'); return; }
  dbg.points=[];dbg.rows=[];dbg.score=0;
  updateDbgPanel();drawDebug();
  toast('已清空所有点');
});
$('#dbgCanvas').addEventListener('wheel',e=>{
  if(!dbg.valid)return;
  e.preventDefault();
  stopViewAnim();
  const c=$('#dbgCanvas'),r=c.getBoundingClientRect();
  if(zoomView(dbg.view,e.clientX-r.left,e.clientY-r.top,e.deltaY>0?1.15:1/1.15,c)){
    $('#dbgZoom').textContent='×'+((dbg.baseView.xmax-dbg.baseView.xmin)/(dbg.view.xmax-dbg.view.xmin)).toFixed(2);
    drawDebug();
  }
},{passive:false});
$('#dbgCanvas').addEventListener('click',async e=>{
  const c=$('#dbgCanvas');
  const r=c.getBoundingClientRect();
  const px=e.clientX-r.left,py=e.clientY-r.top;
  const view=dbg.view;
  const mL=46,mR=16,mT=18,mB=38;
  const pw=(c.clientWidth||500)-mL-mR,ph=(c.clientHeight||500)-mT-mB;
  if(px<mL||px>mL+pw||py<mT||py>mT+ph)return;
  const x=view.xmin+(px-mL)/pw*(view.xmax-view.xmin);
  const y=view.ymax-(py-mT)/ph*(view.ymax-view.ymin);
  const X=xx=>mL+(xx-view.xmin)/(view.xmax-view.xmin)*pw;
  const Y=yy=>mT+ph-(yy-view.ymin)/(view.ymax-view.ymin)*ph;
  const hit=dbg.points.findIndex(p=>Math.hypot(X(p.x)-px,Y(p.y)-py)<13);
  if(hit>=0){ dbg.points.splice(hit,1); sfx.remove(); }
  else{
    if(!dbg.valid&&!dbg.warned){ dbg.warned=true; toast('已放置点；应用合法函数后即可查看距离与得分'); }
    dbg.points.push({x:x,y:y}); sfx.place();
  }
  await evaluateDebugPoints();
  updateDbgPanel();drawDebug();
});

/* ================= 启动 ================= */
bindCanvas();
window.addEventListener('resize',fitCanvas);
fitCanvas();
updateHUD();
(async function boot(){
  const s=await get('/api/save');
  if(s&&s.ok){
    save.bestRound=s.bestRound||0;
    save.bestTotal=s.bestTotal||0;
    updateHUD();
  }
  applyTheme();
  await renderHistory();
  await updateDbgCount();
})();
})();
