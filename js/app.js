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

const COLORS={linear:'#2563eb',quad:'#7c3aed',abs:'#0891b2',cubic:'#db2777',sine:'#16a34a',exp:'#ea580c'};

const FAMILIES={
  linear(){
    const k=(Math.random()<0.5?-1:1)*rand(0.15,0.8);
    const b=rand(-4,4);
    let l='y = '+fmt(k)+'x';
    if(b!==0)l+=' '+sgn(b)+' '+fmt(Math.abs(b));
    return {f:x=>k*x+b,label:l,color:COLORS.linear,type:TYPES.linear,family:'linear',params:{k:k,b:b}};
  },
  quad(){
    const h=rand(-6,6);
    const maxE=Math.max((10-h)*(10-h),(10+h)*(10+h));
    const a=(Math.random()<0.5?-1:1)*rand(0.5,1.2)*(8/maxE);
    const k=rand(-6,6);
    const hPart=h===0?'x²':'(x '+(h<0?'+':'−')+' '+fmt(Math.abs(h))+')²';
    let l='y = '+fmt(a)+hPart;
    if(k!==0)l+=' '+sgn(k)+' '+fmt(Math.abs(k));
    return {f:x=>a*(x-h)*(x-h)+k,label:l,color:COLORS.quad,type:TYPES.quad,family:'quad',params:{a:a,h:h,k:k}};
  },
  abs(){
    const h=rand(-5,5);
    const maxE=Math.max(Math.abs(10-h),Math.abs(10+h));
    const a=(Math.random()<0.5?-1:1)*rand(0.6,1.4)*(8/maxE);
    const k=rand(-6,6);
    const hPart=h===0?'|x|':'|x '+(h<0?'+':'−')+' '+fmt(Math.abs(h))+'|';
    let l='y = '+fmt(a)+hPart;
    if(k!==0)l+=' '+sgn(k)+' '+fmt(Math.abs(k));
    return {f:x=>a*Math.abs(x-h)+k,label:l,color:COLORS.abs,type:TYPES.abs,family:'abs',params:{a:a,h:h,k:k}};
  },
  cubic(){
    const h=rand(-2,2);
    const maxE=Math.max(Math.pow(Math.abs(10-h),3),Math.pow(Math.abs(10+h),3));
    const a=(Math.random()<0.5?-1:1)*rand(0.6,1.3)*(9/maxE);
    const k=rand(-5,5);
    const hPart=h===0?'x³':'(x '+(h<0?'+':'−')+' '+fmt(Math.abs(h))+')³';
    let l='y = '+fmt(a)+hPart;
    if(k!==0)l+=' '+sgn(k)+' '+fmt(Math.abs(k));
    return {f:x=>a*Math.pow(x-h,3)+k,label:l,color:COLORS.cubic,type:TYPES.cubic,family:'cubic',params:{a:a,h:h,k:k}};
  },
  sine(){
    const A=rand(1.5,3.5),B=rand(0.35,1),C=rand(0,Math.PI*2),D=rand(-3,3);
    let l='y = '+fmt(A)+'·sin('+fmt(B)+'x';
    if(C!==0)l+=' '+sgn(C)+' '+fmt(Math.abs(C));
    l+=')';
    if(D!==0)l+=' '+sgn(D)+' '+fmt(Math.abs(D));
    return {f:x=>A*Math.sin(B*x+C)+D,label:l,color:COLORS.sine,type:TYPES.sine,family:'sine',params:{A:A,B:B,C:C,D:D}};
  },
  exp(){
    const a=(Math.random()<0.5?-1:1)*rand(1,3);
    const b=(Math.random()<0.5?-1:1)*rand(0.08,0.2);
    const d=rand(-4,4);
    let l='y = '+fmt(a)+'·e^('+fmt(b)+'x)';
    if(d!==0)l+=' '+sgn(d)+' '+fmt(Math.abs(d));
    return {f:x=>a*Math.exp(b*x)+d,label:l,color:COLORS.exp,type:TYPES.exp,family:'exp',params:{a:a,b:b,d:d}};
  }
};

const TYPES={linear:'一次函数',quad:'二次函数',abs:'绝对值函数',cubic:'三次函数',sine:'正弦函数',exp:'指数函数'};

const DEBUG_KEY='fn-hunter-debug-v1';

const SAVE_KEY='fn-hunter-save-v1';

const HISTORY_KEY='fn-hunter-history-v1';

function preprocessExpr(e){
  let s=String(e).trim().replace(/;$/, '');
  if(!s)return null;
  s=s.replace(/^[yf]\s*\(\s*x\s*\)\s*=\s*/,'').replace(/^y\s*=\s*/,'');
  s=s.replace(/(?<![a-zA-Z.])(sin|cos|tan|asin|acos|atan|sqrt|abs|exp|log|floor|ceil|round)\b/g,'Math.$1');
  s=s.replace(/(^|[^a-zA-Z.])PI\b/g,'$1Math.PI')
     .replace(/(^|[^a-zA-Z.])E\b/g,'$1Math.E')
     .replace(/(^|[^a-zA-Z.])e\b/g,'$1Math.E');
  s=s.replace(/\|([^|]*)\|/g,'Math.abs($1)');
  s=s.replace(/\^/g,'**');
  s=s.replace(/(\d)\s*([a-zA-Z(])/g,'$1*$2');
  return s;
}

function makeFn(e){
  const src=preprocessExpr(e);
  if(!src)return null;
  try{
    const f=new Function('x','return ('+src+');');
    for(const x of [-9.5,-4.2,0,2.1,8.7]){
      const v=f(x);
      if(typeof v!=='number'||!isFinite(v))return null;
    }
    return f;
  }catch(err){return null;}
}

function genFor(fam){
  for(let i=0;i<80;i++){
    const cand=FAMILIES[fam]();
    const [mn,mx]=sampleRange(cand.f);
    const span=mx-mn;
    if(span>=1.2&&span<=16&&mn>=-13.5&&mx<=13.5){
      const pad=Math.max(span*0.12,0.6);
      cand.view={xmin:-10,xmax:10,ymin:Math.max(mn-pad,-14),ymax:Math.min(mx+pad,14)};
      return cand;
    }
  }
  const fb=FAMILIES.linear();
  const [mn,mx]=sampleRange(fb.f);
  const pad=Math.max((mx-mn)*0.12,0.6);
  fb.view={xmin:-10,xmax:10,ymin:Math.max(mn-pad,-14),ymax:Math.min(mx+pad,14)};
  return fb;
}

function sampleRange(f){
  let mn=Infinity,mx=-Infinity;
  for(let x=-10;x<=10.0001;x+=0.1){
    const y=f(x);
    if(y<mn)mn=y; if(y>mx)mx=y;
  }
  return [mn,mx];
}

function materialize(recipe){
  const p=recipe.params||{};
  let f;
  switch(recipe.family){
    case 'linear': f=x=>p.k*x+p.b; break;
    case 'quad':   f=x=>p.a*(x-p.h)*(x-p.h)+p.k; break;
    case 'abs':    f=x=>p.a*Math.abs(x-p.h)+p.k; break;
    case 'cubic':  f=x=>p.a*Math.pow(x-p.h,3)+p.k; break;
    case 'sine':   f=x=>p.A*Math.sin(p.B*x+p.C)+p.D; break;
    case 'exp':    f=x=>p.a*Math.exp(p.b*x)+p.d; break;
    default:       f=x=>x;
  }
  return {f:f,label:recipe.label,color:recipe.color,type:recipe.type,family:recipe.family,params:recipe.params,view:recipe.view||{xmin:-10,xmax:10,ymin:-10,ymax:10}};
}

function fitViewForFn(fn){
  let mn=Infinity,mx=-Infinity;
  for(let x=-10;x<=10.0001;x+=0.1){
    const y=fn(x);
    if(isFinite(y)){ if(y<mn)mn=y; if(y>mx)mx=y; }
  }
  if(!isFinite(mn)){mn=-5;mx=5;}
  let span=mx-mn;
  if(span<1.2){const c=(mn+mx)/2;mn=c-0.6;mx=c+0.6;span=1.2;}
  const pad=Math.max(span*0.12,0.6);
  return {xmin:-10,xmax:10,ymin:Math.max(mn-pad,-14),ymax:Math.min(mx+pad,14)};
}

function evalPoint(p,fn,view){
  const xmin=view&&isFinite(view.xmin)?view.xmin:-10;
  const xmax=view&&isFinite(view.xmax)?view.xmax:10;
  const range=xmax-xmin;
  const n=Math.max(601,Math.ceil(range/0.02));
  let bd=Infinity,bxx=0,byy=0;
  for(let i=0;i<=n;i++){
    const x=xmin+range*i/n,y=fn(x);
    if(!isFinite(y))continue;
    const dx=x-p.x,dy=y-p.y,d=dx*dx+dy*dy;
    if(d<bd){bd=d;bxx=x;byy=y;}
  }
  return {x:p.x,y:p.y,d:Math.sqrt(bd),vert:Math.abs(fn(p.x)-p.y),bx:bxx,by:byy};
}

function nearestInfo(p){
  const f=state.func.f;
  let bd=Infinity,bx=0,by=0;
  for(let i=0;i<=600;i++){
    const x=-10+20*i/600;
    const y=f(x);
    const dx=x-p.x,dy=y-p.y;
    const d=dx*dx+dy*dy;
    if(d<bd){bd=d;bx=x;by=y;}
  }
  return {d:Math.sqrt(bd),bx,by};
}

function persistDebug(){try{localStorage.setItem(DEBUG_KEY,JSON.stringify(debugRecords));}catch(e){}}

function normalizeHistory(arr){
  const map=new Map();
  arr.forEach(h=>{
    if(h&&typeof h==='object'&&typeof h.ts==='number'&&typeof h.score==='number'&&!map.has(h.ts)){
      map.set(h.ts,h);
    }
  });
  return Array.from(map.values()).sort((a,b)=>b.ts-a.ts).slice(0,200);
}





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
let actx=null,muted=false,sfxOn=true;
try{sfxOn=localStorage.getItem('fn-sfx')!=='off';}catch(e){}
function beep(f,d,type,g){
  if(muted||!sfxOn)return;
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
function fmtDur(sec){
  const t=Math.max(0,Math.floor(sec||0));
  const p=n=>String(n).padStart(2,'0');
  return p(Math.floor(t/60))+':'+p(t%60);
}
async function renderHistory(){
  const r=await get('/api/history');
  if(!r||!r.ok)return;
  history=r.list||[];
  const n=history.length;
  $('#histCount').textContent=n;
  const fnHist=history.filter(h=>h.mode!=='axis'&&h.mode!=='battle'&&h.mode!=='g24');
  const nFn=fnHist.length;
  const avg=nFn?Math.round(fnHist.reduce((a,h)=>a+h.score,0)/nFn*10)/10:0;
  const mx=nFn?Math.max.apply(null,fnHist.map(h=>h.score)):0;
  const full=nFn?fnHist.filter(h=>h.score>=99.5).length:0;
  const axisHist=history.filter(h=>h.mode==='axis');
  const maxRounds=axisHist.length?Math.max.apply(null,axisHist.map(h=>h.rounds||h.score)):0;
  const enterHist=axisHist.filter(h=>h.rule==='enter'&&h.avgScore!=null);
  const bestEnter=enterHist.length?Math.max.apply(null,enterHist.map(h=>h.avgScore)):0;
  const battleHist=history.filter(h=>h.mode==='battle');
  const maxBattle=battleHist.length?Math.max.apply(null,battleHist.map(h=>h.duration||h.score)):0;
  const g24Hist=history.filter(h=>h.mode==='g24');
  const g24Solved=g24Hist.filter(h=>h.solved);
  const g24Best=g24Solved.length?Math.min.apply(null,g24Solved.map(h=>h.duration||h.score)):0;
  $('#histStats').innerHTML=
    '<div class="chip">场次 <b>'+n+'</b></div>'+
    '<div class="chip">平均分 <b>'+fmt(avg)+'</b></div>'+
    '<div class="chip">最高分 <b>'+fmt(mx)+'</b></div>'+
    '<div class="chip">满分次数 <b>'+full+'</b></div>'+
    '<div class="chip" title="点之趋安最高坚持轮数">趋安最佳 <b>'+maxRounds+'</b></div>'+
    '<div class="chip" title="落入靶心模式最高评分">落靶最高 <b>'+fmt(bestEnter)+'</b></div>'+
    '<div class="chip" title="对战模式最长坚持时长">对战最长 <b>'+fmtDur(maxBattle)+'</b></div>'+
    '<div class="chip" title="24点挑战最快解出用时">24点最佳 <b>'+(g24Best?fmtDur(g24Best):'—')+'</b></div>';
  const list=$('#histList');
  if(!n){ list.innerHTML='<div class="empty">还没有对局记录，先去开始游戏玩一局吧！</div>'; return; }
  list.innerHTML=history.map((h,i)=>{
    if(h.mode==='battle'){
      return '<div class="hrow">'+
        '<div class="hscore"><b>'+fmtDur(h.duration||h.score)+'</b><span></span></div>'+
        '<div class="hmain"><div class="hformula"><i style="background:#7c3aed"></i>点之对战</div>'+
        '<div class="hmeta">击杀 '+h.kills+' 只 · 坚持 '+fmtDur(h.duration||h.score)+' · '+timeStr(h.ts)+'</div></div>'+
        '<div><span class="badge '+(h.survived?'b-ok':'b-out')+'">'+(h.survived?'主动退出':'阵亡')+'</span></div>'+
        '<div class="hbtns"></div>'+
      '</div>';
    }
    if(h.mode==='axis'){
      return '<div class="hrow">'+
        '<div class="hscore"><b>'+fmt(h.score)+'</b><span>轮</span></div>'+
        '<div class="hmain"><div class="hformula"><i style="background:#db2777"></i>'+escapeHtml(h.formula)+'</div>'+
        '<div class="hmeta">点之趋安 · '+h.levelName+' · 坚持 '+h.rounds+' 轮'+(h.avgScore!=null?(' · 评分 '+h.avgScore):'')+' · '+timeStr(h.ts)+'</div></div>'+
        '<div><span class="badge '+(h.survived?'b-ok':'b-out')+'">'+(h.survived?'主动退出':'被淘汰')+'</span></div>'+
        '<div class="hbtns"><button class="hbtn" data-i="'+i+'" data-act="axisdetail">详情</button></div>'+
      '</div>';
    }
    if(h.mode==='g24'){
      return '<div class="hrow">'+
        '<div class="hscore"><b>'+fmtDur(h.duration||h.score)+'</b><span></span></div>'+
        '<div class="hmain"><div class="hformula"><i style="background:#0891b2"></i>24点挑战</div>'+
        '<div class="hmeta">'+(h.solved?'解出 24':'未解出')+' · '+h.steps+' 步 · 牌面 '+(h.cards||'')+' · '+timeStr(h.ts)+'</div></div>'+
        '<div><span class="badge '+(h.solved?'b-perfect':'b-out')+'">'+(h.solved?'解出':'未解出')+'</span></div>'+
        '<div class="hbtns"></div>'+
      '</div>';
    }
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
  const r=await post('/api/debug/evaluate',{expr:dbg.expr,points:dbg.points,view:dbg.baseView||dbg.view});
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
    if(document.fullscreenElement||BT.active)return;
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
let bgmOn=true;
try{bgmOn=localStorage.getItem('fn-bgm')!=='off';}catch(e){}
function bgmPlay(){ const b=document.getElementById('bgm'); if(b) b.play().catch(()=>{}); }
function bgmPause(){ const b=document.getElementById('bgm'); if(b) b.pause(); }
$('#muteBtn').addEventListener('click',()=>{
  muted=!muted;
  $('#muteBtn').textContent=muted?'🔇':'🔊';
  if(muted)bgmPause(); else if(bgmOn)bgmPlay();
});
(function initBgm(){
  const b=document.getElementById('bgm');
  if(!b)return;
  try{b.volume=0.5;}catch(e){}
  const t=document.getElementById('bgmToggle');
  if(t){
    t.checked=bgmOn;
    t.addEventListener('change',()=>{
      bgmOn=t.checked;
      try{localStorage.setItem('fn-bgm',bgmOn?'on':'off');}catch(e){}
      if(bgmOn){ if(!muted)bgmPlay(); } else bgmPause();
    });
  }
  const kick=()=>{
    if(!muted&&bgmOn){
      const b=document.getElementById('bgm');
      if(b&&b.paused)bgmPlay();
    }
  };
  document.addEventListener('pointerdown',kick);
  document.addEventListener('keydown',kick);
  if(!muted&&bgmOn)bgmPlay();
  const c=document.getElementById('clickSnd');
  if(c){
    try{c.volume=0.85;}catch(e){}
    document.addEventListener('click',()=>{
      if(muted||!sfxOn)return;
      try{c.currentTime=0;c.play();}catch(e){}
    },true);
  }
  const st=document.getElementById('sfxToggle');
  if(st){
    st.checked=sfxOn;
    st.addEventListener('change',()=>{
      sfxOn=st.checked;
      try{localStorage.setItem('fn-sfx',sfxOn?'on':'off');}catch(e){}
    });
  }
})();
const entryDlg=document.getElementById('entryDlg');
if(entryDlg){
  entryDlg.addEventListener('click',()=>{
    if(entryDlg.classList.contains('hide'))return;
    entryDlg.classList.add('enter');
    if(!muted&&bgmOn)bgmPlay();
    setTimeout(()=>entryDlg.classList.add('hide'),520);
  });
}
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
    const tab=b.dataset.tab;
    $('#tabPlay').classList.toggle('hide',tab!=='play');
    $('#tabHistory').classList.toggle('hide',tab!=='history');
    $('#tabAxis').classList.toggle('hide',tab!=='axis');
    $('#tabBattle').classList.toggle('hide',tab!=='battle');
    $('#tabG24').classList.toggle('hide',tab!=='g24');
    $('#tabSettings').classList.toggle('hide',tab!=='settings');
    if(tab==='history')renderHistory();
    if(tab==='axis'){ renderAxisMgrid(); $('#axisSetupDlg').classList.add('hide'); }
    if(tab!=='axis')exitAxis();
    if(tab!=='battle')btExit();
    if(tab!=='g24')g24Exit();
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
  if(b.dataset.act==='axisdetail'){
    openAxisDetail(h);
  }else if(b.dataset.act==='replay'){
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

/* ================= 点之趋安模式（Axis Dodge） ================= */
const AXIS_LEVELS={
  easy:{key:'easy',name:'入门',desc:'加减法',wait:6,rest:3},
  normal:{key:'normal',name:'进阶',desc:'加減乘',wait:5,rest:3},
  hard:{key:'hard',name:'专家',desc:'括号 · √ · ∛ · log',wait:4,rest:3},
  mix:{key:'mix',name:'混合',desc:'全部综合',wait:4,rest:3}
};
const AXMIN=-8, AXMAX=8, AX_RES_MIN=-8, AX_RES_MAX=8;
const axisState={active:false,loopOn:false,level:null,round:0,res:0,formula:'',playerX:0,moveDir:0,lastMove:0,timeLeft:0,timerId:null,restId:null,phase:'idle',radius:1,roundRadius:1,marks:null,laserUntil:0,roundsData:[],rule:'avoid',scoreSum:0,scoreCount:0};
function iRand(a,b){ return a+Math.floor(Math.random()*(b-a+1)); }
function genAxisExpr(levelKey){
  for(let i=0;i<300;i++){
    let a,b,c,res,formula;
    if(levelKey==='easy'){
      a=iRand(1,10); b=iRand(1,10); const op=iRand(0,1)?'+':'−';
      res=op==='+'?a+b:a-b; formula=a+' '+op+' '+b+' = ?';
    }else if(levelKey==='normal'){
      if(iRand(0,1)===0){ a=iRand(2,6); b=iRand(2,6); c=iRand(1,5); const op=iRand(0,1)?'+':'−';
        res=a*b+(op==='+'?c:-c); formula=a+' × '+b+' '+(op==='+'?'+':'−')+' '+c+' = ?';
      }else{ a=iRand(-5,5); b=iRand(2,4); c=iRand(2,4); res=a+b*c; formula=a+' + '+b+' × '+c+' = ?'; }
    }else if(levelKey==='hard'){
      const k=iRand(0,5);
      if(k===0){ a=iRand(1,5); b=iRand(1,5); c=iRand(2,5); res=(a+b)*c; formula='('+a+' + '+b+') × '+c+' = ?'; }
      else if(k===1){ a=iRand(2,6); b=iRand(2,6); c=iRand(1,5); res=a*b-c; formula=a+' × '+b+' − '+c+' = ?'; }
      else if(k===2){ a=iRand(2,30); b=iRand(-4,4); res=Math.sqrt(a)+b; formula='√('+a+') '+(b<0?'−':'+')+' '+Math.abs(b)+' = ?'; }
      else if(k===3){ a=iRand(2,30); b=iRand(-4,4); res=Math.cbrt(a)+b; formula='∛('+a+') '+(b<0?'−':'+')+' '+Math.abs(b)+' = ?'; }
      else{ a=iRand(2,32); b=iRand(-3,3); res=Math.log2(a)+b; formula='log₂('+a+') '+(b<0?'−':'+')+' '+Math.abs(b)+' = ?'; }
    }else{
      const t=iRand(0,9);
      if(t===0){ a=iRand(1,10); b=iRand(1,10); const op=iRand(0,1)?'+':'−'; res=op==='+'?a+b:a-b; formula=a+' '+op+' '+b+' = ?'; }
      else if(t===1){ a=iRand(2,6); b=iRand(2,6); c=iRand(1,5); res=a*b+c; formula=a+' × '+b+' + '+c+' = ?'; }
      else if(t===2){ a=iRand(-5,5); b=iRand(2,4); c=iRand(2,4); res=a+b*c; formula=a+' + '+b+' × '+c+' = ?'; }
      else if(t===3){ a=iRand(1,5); b=iRand(1,5); c=iRand(2,5); res=(a+b)*c; formula='('+a+' + '+b+') × '+c+' = ?'; }
      else if(t===4){ a=iRand(2,6); b=iRand(2,6); c=iRand(1,5); res=a*b-c; formula=a+' × '+b+' − '+c+' = ?'; }
      else if(t===5){ a=iRand(2,30); b=iRand(-4,4); res=Math.sqrt(a)+b; formula='√('+a+') '+(b<0?'−':'+')+' '+Math.abs(b)+' = ?'; }
      else if(t===6||t===7){ a=iRand(2,32); b=iRand(-3,3); res=Math.log2(a)+b; formula='log₂('+a+') '+(b<0?'−':'+')+' '+Math.abs(b)+' = ?'; }
      else if(t===8){ const sq=iRand(2,4); a=iRand(1,2); b=sq*sq; c=iRand(0,4); res=a*sq-c; formula=a+' × √('+b+') − '+c+' = ?'; }
      else{ a=iRand(2,30); b=iRand(-4,4); res=Math.cbrt(a)+b; formula='∛('+a+') '+(b<0?'−':'+')+' '+Math.abs(b)+' = ?'; }
    }
    if(res>=AX_RES_MIN && res<=AX_RES_MAX){
      if(res!==0 && Math.random()<0.45){
        res=-res;
        formula='−('+formula.slice(0,-4)+') = ?';
      }
      return {formula:formula,res:res};
    }
  }
  return {formula:'3 + 2 = ?',res:5};
}
let pendingAxisLevel='easy';
function renderAxisMgrid(){
  const grid=$('#axisMgrid'); if(!grid)return; grid.innerHTML='';
  Object.values(AXIS_LEVELS).forEach(L=>{
    const card=document.createElement('div');
    card.className='mcard'; card.dataset.l=L.key;
    card.innerHTML='<h4>'+L.name+'</h4><p>'+L.desc+'</p><span class="tag">等待 '+L.wait+'s</span>';
    card.addEventListener('click',()=>{
      pendingAxisLevel=L.key;
      $('#axisSetupTitle').textContent='点之趋安 · '+L.name;
      $('#axisSetupLevel').textContent=L.desc+' · 等待 '+L.wait+'s';
      document.querySelectorAll('#axisRule .rule-btn').forEach(x=>x.classList.toggle('active',x.dataset.rule===axisState.rule));
      $('#axisRadius').value=axisState.radius;
      $('#axisRadiusVal').textContent=axisState.radius.toFixed(2);
      $('#axisSetupDlg').classList.remove('hide');
    });
    grid.appendChild(card);
  });
}
function drawAxis(){
  const c=$('#axisCanvas'); if(!c)return; const ctx=c.getContext('2d');
  const W=c.width,H=c.height,mL=24,mR=24,mT=50,mB=70;
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  ctx.fillStyle=isDark?'#121927':'#ffffff'; ctx.fillRect(0,0,W,H);
  const midY=(mT+(H-mB))/2;
  const X=v=>mL+(v-AXMIN)/(AXMAX-AXMIN)*(W-mL-mR);
  const zc=axisState.rule==='enter'?{rgb:'34,197,94',main:'#22c55e',soft:'#4ade80',glow:'74,222,128',dim:'20,120,60'}:{rgb:'239,68,68',main:'#ef4444',soft:'#ff6b6b',glow:'255,120,120',dim:'255,80,80'};
  if(axisState.marks){
    const x1=X(axisState.marks.low),x2=X(axisState.marks.high);
    const g=ctx.createLinearGradient(x1,0,x2,0);
    g.addColorStop(0,'rgba('+zc.rgb+',0)');
    g.addColorStop(0.5,'rgba('+zc.rgb+',0.6)');
    g.addColorStop(1,'rgba('+zc.rgb+',0)');
    ctx.fillStyle=g; ctx.fillRect(x1,mT,x2-x1,H-mT-mB);
    ctx.strokeStyle=zc.main; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(x1,midY); ctx.lineTo(x2,midY); ctx.stroke();
  }
  if(Date.now()<axisState.laserUntil && axisState.marks){
    const x1=X(axisState.marks.low),x2=X(axisState.marks.high);
    const cx=(x1+x2)/2;
    const lg=ctx.createLinearGradient(0,mT,0,H-mB);
    lg.addColorStop(0,'rgba('+zc.dim+',0.2)');
    lg.addColorStop((midY-mT)/(H-mT-mB),'rgba('+zc.glow+',1)');
    lg.addColorStop(1,'rgba('+zc.dim+',0.2)');
    ctx.fillStyle=lg; ctx.fillRect(x1,mT,x2-x1,H-mT-mB);
    ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(cx,mT); ctx.lineTo(cx,H-mB); ctx.stroke();
    ctx.strokeStyle=zc.main; ctx.lineWidth=6;
    ctx.beginPath(); ctx.moveTo(x1,midY); ctx.lineTo(x2,midY); ctx.stroke();
    ctx.strokeStyle=zc.soft; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(x1,midY-10); ctx.lineTo(x1,midY+10); ctx.moveTo(x2,midY-10); ctx.lineTo(x2,midY+10); ctx.stroke();
  }
  ctx.strokeStyle=isDark?'#3a465c':'#cbd2e0'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(X(AXMIN),midY); ctx.lineTo(X(AXMAX),midY); ctx.stroke();
  ctx.fillStyle=isDark?'#97a1b5':'#9aa3b5'; ctx.font='12px system-ui'; ctx.textAlign='center';
  for(let v=AXMIN;v<=AXMAX;v+=2){ const x=X(v); ctx.beginPath(); ctx.moveTo(x,midY-5); ctx.lineTo(x,midY+5); ctx.stroke(); ctx.fillText(String(v),x,midY+22); }
  ctx.fillStyle=isDark?'#e7ebf3':'#1f2430'; ctx.beginPath(); ctx.arc(X(0),midY,3,0,Math.PI*2); ctx.fill();
  const px=X(axisState.playerX);
  ctx.strokeStyle='rgba(79,70,229,.35)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(px,mT); ctx.lineTo(px,H-mB); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#4f46e5'; ctx.beginPath(); ctx.arc(px,midY,9,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.stroke();
}
function axisGameLoop(t){
  if(!axisState.active)return;
  if(axisState.phase==='play' && axisState.moveDir && t-axisState.lastMove>15){
    axisState.playerX=clamp(axisState.playerX+axisState.moveDir*0.1,AXMIN,AXMAX);
    axisState.lastMove=t; $('#axisPos').textContent=fmt(axisState.playerX);
  }
  drawAxis();
  requestAnimationFrame(axisGameLoop);
}
function axisNextRound(){
  axisState.round++;
  const e=genAxisExpr(axisState.level.key);
  axisState.formula=e.formula; axisState.res=e.res;
  axisState.phase='play'; axisState.timeLeft=axisState.level.wait; axisState.moveDir=0;
  axisState.marks=null; axisState.laserUntil=0;
  $('#axisRound').textContent='第 '+axisState.round+' 轮';
  $('#axisLevel').textContent=axisState.level.name;
  $('#axisFormula').textContent=axisState.formula;
  $('#axisPos').textContent=fmt(axisState.playerX);
  $('#axisTimer').textContent=axisState.timeLeft.toFixed(1)+'s';
  drawAxis();
  clearInterval(axisState.timerId);
  axisState.timerId=setInterval(()=>{
    axisState.timeLeft-=0.1;
    if(axisState.timeLeft<=0){ axisState.timeLeft=0; $('#axisTimer').textContent='0.0s'; clearInterval(axisState.timerId); axisResolveRound(); return; }
    $('#axisTimer').textContent=axisState.timeLeft.toFixed(1)+'s';
  },100);
}
function axisResolveRound(){
  axisState.phase='rest'; clearInterval(axisState.timerId);
  const r=axisState.roundRadius;
  const inZone=Math.abs(axisState.playerX-axisState.res)<=r;
  const hit = axisState.rule==='enter' ? !inZone : inZone;
  let scoreRound=null;
  if(!hit && axisState.rule==='enter'){
    scoreRound=Math.max(0,Math.round(100*(1-Math.abs(axisState.playerX-axisState.res)/r)));
    axisState.scoreSum+=scoreRound; axisState.scoreCount++;
    const se=$('#axisScore');
    if(se) se.textContent='评分 '+Math.round(axisState.scoreSum/axisState.scoreCount);
  }
  axisState.marks={low:axisState.res-r,high:axisState.res+r};
  axisState.laserUntil=Date.now()+1000;
  axisState.roundsData.push({round:axisState.round,formula:axisState.formula,res:axisState.res,playerX:axisState.playerX,dangerLow:axisState.res-r,dangerHigh:axisState.res+r,hit:hit,score:scoreRound});
  drawAxis();
  if(hit){
    axisState.restId=setTimeout(()=>{ axisGameOver(); }, 1000);
    return;
  }
  $('#axisTimer').textContent='安全 ✓';
  axisState.restId=setTimeout(()=>{ if(axisState.active)axisNextRound(); }, axisState.level.rest*1000);
}
function axisGameOver(){
  axisState.active=false; axisState.phase='over'; axisState.loopOn=false; clearInterval(axisState.timerId); clearTimeout(axisState.restId);
  const survived=Math.max(0,axisState.round-1);
  const entry={
    mode:'axis', ts:Date.now(), score:survived, rounds:survived,
    levelKey:axisState.level.key, levelName:axisState.level.name,
    formula:axisState.formula, res:axisState.res,
    radius:axisState.roundRadius, rule:axisState.rule,
    avgScore:axisState.scoreCount?Math.round(axisState.scoreSum/axisState.scoreCount):null,
    dangerLow:axisState.res-axisState.roundRadius, dangerHigh:axisState.res+axisState.roundRadius,
    playerPos:axisState.playerX, survived:false,
    roundsData:axisState.roundsData.slice()
  };
  post('/api/history',{entry:entry});
  if(sfx&&sfx.timeout)sfx.timeout();
  showAxisResult({rounds:survived,levelName:axisState.level.name,formula:axisState.formula,res:axisState.res,playerPos:axisState.playerX,radius:axisState.roundRadius,rule:axisState.rule,avgScore:axisState.scoreCount?Math.round(axisState.scoreSum/axisState.scoreCount):null,dangerLow:axisState.res-axisState.roundRadius,dangerHigh:axisState.res+axisState.roundRadius});
}
function axisInfoHtml(d){
  const dl=d.dangerLow!==undefined?d.dangerLow:(d.res-(d.radius||1));
  const dh=d.dangerHigh!==undefined?d.dangerHigh:(d.res+(d.radius||1));
  const ruleTxt=d.rule==='enter'?'✅ 落入靶心':'❌ 避开险区';
  const resTxt=d.survived?'主动退出':(d.rule==='enter'?'偏离靶心淘汰':'落入危险区淘汰');
  return '<div class="row"><span>本题算式</span><b>'+escapeHtml(d.formula)+'</b></div>'+
    '<div class="row"><span>答案</span><b>'+fmt(d.res)+'</b></div>'+
    '<div class="row"><span>规则</span><b>'+ruleTxt+'</b></div>'+
    (d.avgScore!=null?('<div class="row"><span>评分</span><b>'+d.avgScore+' 分</b></div>'):'')+
    '<div class="row"><span>危险区</span><b>['+fmt(dl)+', '+fmt(dh)+']</b></div>'+
    '<div class="row"><span>你的位置</span><b>'+fmt(d.playerPos)+'</b></div>'+
    '<div class="row"><span>结果</span><b style="color:'+(d.survived?'var(--green)':'var(--red)')+'">'+resTxt+'</b></div>';
}
function axisDetailHtml(h){
  let s='<div class="axis-r-info">'+axisInfoHtml(h)+'</div>';
  if(Array.isArray(h.roundsData)&&h.roundsData.length){
    s+='<div class="axis-r-rounds"><h4>每轮详情（共 '+h.roundsData.length+' 轮）</h4>';
    s+=h.roundsData.map(r=>{
      const id='ar-'+h.ts+'-'+r.round;
      return '<div class="axis-r-row">'+
        '<div class="axis-r-row-head"><span class="axis-r-num">#'+r.round+'</span><b>'+escapeHtml(r.formula)+'</b>'+
          (r.hit?'<span class="badge b-out">'+(h.rule==='enter'?'偏移':'命中')+'</span>':'<span class="badge b-ok">安全</span>')+
          '<span class="axis-r-row-pos">你: <b>'+fmt(r.playerX)+'</b> · 危险: ['+fmt(r.dangerLow)+', '+fmt(r.dangerHigh)+']</span>'+
        '</div>'+
        '<canvas class="axis-r-mini" id="'+id+'" width="320" height="50"></canvas>'+
      '</div>';
    }).join('');
    s+='</div>';
  }
  return s;
}
function drawAxisMini(canvas,r,rule){
  const zc=(rule||'avoid')==='enter'?{rgb:'34,197,94',main:'#22c55e'}:{rgb:'239,68,68',main:'#ef4444'};
  const ctx=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height;
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  ctx.fillStyle=isDark?'#121927':'#fff'; ctx.fillRect(0,0,W,H);
  const X=v=>(v-AXMIN)/(AXMAX-AXMIN)*W;
  const midY=H/2;
  ctx.strokeStyle=isDark?'#3a465c':'#cbd2e0'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,midY); ctx.lineTo(W,midY); ctx.stroke();
  if(r.dangerLow!==undefined){
    const x1=Math.max(0,X(r.dangerLow)),x2=Math.min(W,X(r.dangerHigh));
    if(x2>0 && x1<W){
      const g=ctx.createLinearGradient(x1,0,x2,0);
      g.addColorStop(0,'rgba('+zc.rgb+',0)');
      g.addColorStop(0.5,'rgba('+zc.rgb+',0.5)');
      g.addColorStop(1,'rgba('+zc.rgb+',0)');
      ctx.fillStyle=g; ctx.fillRect(x1,midY-7,x2-x1,14);
      ctx.strokeStyle=zc.main; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(X(r.dangerLow),midY); ctx.lineTo(X(r.dangerHigh),midY); ctx.stroke();
    }
  }
  const px=X(r.playerX);
  if(px>=-2 && px<=W+2){
    ctx.fillStyle='#4f46e5'; ctx.beginPath(); ctx.arc(px,midY,4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke();
  }
}
function openAxisDetail(h){
  $('#axisRTitle').textContent='点之趋安 · 历史对局';
  $('#axisRSub').textContent='难度 '+h.levelName+' · 坚持 '+(h.rounds||0)+' 轮 · '+timeStr(h.ts);
  $('#axisRInfo').innerHTML=axisDetailHtml(h);
  $('#axisRetryBtn').classList.add('hide');
  $('#axisResult').classList.remove('hide');
  if(Array.isArray(h.roundsData)){
    h.roundsData.forEach(r=>{
      const c=document.getElementById('ar-'+h.ts+'-'+r.round);
      if(c) drawAxisMini(c,r,h.rule);
    });
  }
}
function showAxisResult(d){
  $('#axisRTitle').textContent='被淘汰！';
  $('#axisRSub').textContent='难度 '+d.levelName+' · 坚持 '+d.rounds+' 轮'+(d.avgScore!=null?(' · 评分 '+d.avgScore):'');
  $('#axisRInfo').innerHTML=axisInfoHtml(d);
  $('#axisRetryBtn').classList.remove('hide');
  $('#axisResult').classList.remove('hide');
}
function exitAxis(){
  if(axisState.active && axisState.phase!=='over' && axisState.roundsData.length){
    const survived=axisState.roundsData.filter(r=>!r.hit).length;
    const entry={
      mode:'axis', ts:Date.now(), score:survived, rounds:survived,
      levelKey:axisState.level.key, levelName:axisState.level.name,
      formula:axisState.formula, res:axisState.res,
      radius:axisState.roundRadius, rule:axisState.rule,
      avgScore:axisState.scoreCount?Math.round(axisState.scoreSum/axisState.scoreCount):null,
      dangerLow:axisState.res-axisState.roundRadius, dangerHigh:axisState.res+axisState.roundRadius,
      playerPos:axisState.playerX, survived:true,
      roundsData:axisState.roundsData.slice()
    };
    post('/api/history',{entry:entry});
    toast('已保存本局进度（坚持 '+survived+' 轮）');
  }
  axisState.active=false; axisState.phase='idle'; axisState.moveDir=0; axisState.loopOn=false;
  clearInterval(axisState.timerId); clearTimeout(axisState.restId);
  $('#axisGame').classList.add('hide');
  $('#axisMgrid').classList.remove('hide');
  $('#axisResult').classList.add('hide');
}
function startAxis(levelKey){
  axisState.active=true; axisState.level=AXIS_LEVELS[levelKey]; axisState.round=0; axisState.moveDir=0;
  axisState.playerX=iRand(AXMIN,AXMAX);
  axisState.radius=parseFloat($('#axisRadius').value);
  axisState.roundsData=[];
  axisState.roundRadius=axisState.radius; axisState.marks=null; axisState.laserUntil=0;
  axisState.scoreSum=0; axisState.scoreCount=0;
  $('#axisRoundRadius').textContent=axisState.roundRadius.toFixed(2);
  $('#axisRuleTag').textContent=axisState.rule==='enter'?'✅ 落入靶心':'❌ 避开险区';
  const se=$('#axisScore');
  if(se){ se.classList.toggle('hide',axisState.rule!=='enter'); se.textContent=''; }
  $('#axisMgrid').classList.add('hide');
  $('#axisGame').classList.remove('hide');
  $('#axisResult').classList.add('hide');
  if(!axisState.loopOn){ axisState.loopOn=true; requestAnimationFrame(axisGameLoop); }
  axisNextRound();
}
document.addEventListener('keydown',e=>{
  if(!axisState.active||axisState.phase!=='play')return;
  if(e.key==='ArrowLeft'){ axisState.moveDir=-1; e.preventDefault(); }
  else if(e.key==='ArrowRight'){ axisState.moveDir=1; e.preventDefault(); }
});
document.addEventListener('keyup',e=>{
  if(e.key==='ArrowLeft'&&axisState.moveDir===-1)axisState.moveDir=0;
  else if(e.key==='ArrowRight'&&axisState.moveDir===1)axisState.moveDir=0;
});
$('#axisQuitBtn').addEventListener('click',exitAxis);
$('#axisRetryBtn').addEventListener('click',()=>{ $('#axisResult').classList.add('hide'); startAxis(axisState.level?axisState.level.key:'easy'); });
$('#axisMenuBtn').addEventListener('click',()=>{ $('#axisResult').classList.add('hide'); exitAxis(); });
$('#axisRadius').addEventListener('input',e=>{
  const v=parseFloat(e.target.value);
  axisState.radius=v;
  $('#axisRadiusVal').textContent=v.toFixed(2);
});
$('#axisStartBtn').addEventListener('click',()=>{
  $('#axisSetupDlg').classList.add('hide');
  startAxis(pendingAxisLevel||'easy');
});
$('#axisCancelBtn').addEventListener('click',()=>{ $('#axisSetupDlg').classList.add('hide'); });
document.querySelectorAll('#axisRule .rule-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('#axisRule .rule-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    axisState.rule=b.dataset.rule;
  });
});
/* ===== ⚔ 点之对战（Function Battle）===== */
const BT={active:false,raf:null,lastT:0,W:2400,H:1800,LW:880,LH:560,WALL_T:5,keys:{},mode:'classic',custom:null,hpMax:100,maxE:250,packInt:10,spawnInt:4,bossInt:300};
const BT_DEAD=0.005,BT_HP=100,BT_DMG=5,BT_ATK_CD=1.4,BT_ATK_RANGE=80,BT_SPAWN_INT=4,BT_PACK_INT=10,BT_MAX_M=12,BT_MAX_E=250,BT_MAX_E_C=100,BT_RECHARGE_E=5,BT_RECHARGE_T=5,BT_WALL_E=5,BT_WALL_CD=10,BT_BOSS_INT=300,BT_BOSS_INT_BS=60,BT_BOSS_DMG=8,BT_MAX_BOSS=10;
const BT_W=[
  {label:'-1',c:1,fn:v=>v-1},
  {label:'√',c:3,fn:v=>(v<0?null:Math.sqrt(v))},
  {label:'÷2',c:2,fn:v=>v/2},
  {label:'×(-1)',c:0,fn:v=>-v}
];
const BT_F=[
  {f:'1²',v:1},{f:'2²',v:4},{f:'3²',v:9},{f:'4²',v:16},{f:'5²',v:25},{f:'6²',v:36},{f:'7²',v:49},
  {f:'√16',v:4},{f:'√25',v:5},{f:'√36',v:6},{f:'√49',v:7},{f:'√64',v:8},{f:'√81',v:9},{f:'√100',v:10},
  {f:'2×3',v:6},{f:'3×4',v:12},{f:'4×5',v:20},{f:'5×6',v:30},
  {f:'3+5',v:8},{f:'4+7',v:11},{f:'6+9',v:15},{f:'8+9',v:17},{f:'10+7',v:17},
  {f:'-2',v:-2},{f:'-3',v:-3},{f:'-5',v:-5},{f:'-7',v:-7}
];
function btApply(m,w){ const r=w.fn(m.val); if(r===null||r===undefined)return; m.val=r; }
function btResolveWall(e,r){
  for(const w of BT.walls){
    const d=Math.hypot(w.x2-w.x1,w.y2-w.y1);
    const t=Math.max(0,Math.min(1,((e.x-w.x1)*(w.x2-w.x1)+(e.y-w.y1)*(w.y2-w.y1))/(d*d)));
    const cx=w.x1+(w.x2-w.x1)*t, cy=w.y1+(w.y2-w.y1)*t;
    const dist=Math.hypot(e.x-cx,e.y-cy), min=r+w.th/2;
    if(dist>=min)continue;
    const dx=w.x2-w.x1,dy=w.y2-w.y1,len=Math.hypot(dx,dy)||1;
    const nx=-dy/len,ny=dx/len;
    const cx2=(w.x1+w.x2)/2,cy2=(w.y1+w.y2)/2;
    const side=(e.x-cx2)*nx+(e.y-cy2)*ny>=0?1:-1;
    e.x+=nx*side*(min-dist); e.y+=ny*side*(min-dist);
  }
}
function btReset(){
  const m=BT.mode=BT.mode||'classic';
  const c=(m==='custom'&&BT.custom)?BT.custom:null;
  BT.hpMax=c?Math.max(1,c.hp||BT_HP):(m==='nohurt'?1:BT_HP);
  BT.maxE=c?Math.max(1,c.energy||BT_MAX_E):((m==='classic'||m==='nohurt')?BT_MAX_E_C:BT_MAX_E);
  BT.packInt=c?Math.max(1,c.pack||BT_PACK_INT):BT_PACK_INT;
  BT.spawnInt=c?Math.max(1,c.spawn||BT_SPAWN_INT):BT_SPAWN_INT;
  BT.bossInt=c?Math.max(1,c.boss||BT_BOSS_INT):BT_BOSS_INT;
  BT.player={x:BT.W/2,y:BT.H/2,r:14,hp:BT.hpMax,energy:BT.maxE,dx:0,dy:1,weapon:0,atkFlash:0,invT:0};
  BT.monsters=[];BT.bullets=[];BT.walls=[];BT.packs=[];
  BT.keys={};BT.spawnT=0;BT.packT=0;BT.kills=0;BT.wallCd=0;BT.startT=performance.now();BT.mouse=null;BT.recharging=false;BT.rechargeT=0;BT.paused=false;BT.bosses=[];
  BT.bossT=m==='boss'?0:BT.bossInt;
  if(m!=='boss')for(let i=0;i<5;i++)btSpawnMonster(true);
}
function btSpawnBoss(){
  if(BT.bosses.length>=BT_MAX_BOSS)return;
  const hp=500+Math.floor(Math.random()*1001);
  const b={x:100,y:100,r:30,val:hp,hpMax:hp,vx:0,vy:0,chgT:0,atkT:0};
  for(let t=0;t<40;t++){
    b.x=100+Math.random()*(BT.W-200); b.y=100+Math.random()*(BT.H-200);
    if(BT.player&&Math.hypot(b.x-BT.player.x,b.y-BT.player.y)>350)break;
  }
  BT.bosses.push(b);
  toast('☠ BOSS 来袭！');
  beep(90,.35,'sawtooth',.1);setTimeout(()=>beep(70,.4,'sawtooth',.1),300);
}
function btBossDie(b){
  const i=BT.bosses.indexOf(b); if(i>=0)BT.bosses.splice(i,1);
  BT.kills++;
  beep(200,.2,'sawtooth',.09);setTimeout(()=>beep(400,.25,'triangle',.09),150);
  toast('BOSS 击破！掉落血包');
  const n=5+Math.floor(Math.random()*6);
  for(let k=0;k<n;k++){
    const a=(k/n)*Math.PI*2+(Math.random()-0.5)*0.6;
    const d=45+Math.random()*50;
    BT.packs.push({x:Math.max(25,Math.min(BT.W-25,b.x+Math.cos(a)*d)),y:Math.max(25,Math.min(BT.H-25,b.y+Math.sin(a)*d)),heal:10+Math.floor(Math.random()*6)});
  }
}
function btSpawnMonster(initial){
  const item=BT_F[Math.floor(Math.random()*BT_F.length)];
  const m={x:0,y:0,r:17,val:item.v,formula:item.f,vx:0,vy:0,chgT:0,atkT:0};
  for(let t=0;t<40;t++){
    m.x=60+Math.random()*(BT.W-120); m.y=60+Math.random()*(BT.H-120);
    if(!initial&&BT.player&&Math.hypot(m.x-BT.player.x,m.y-BT.player.y)<260)continue;
    break;
  }
  m.chgT=Math.random()*3;
  BT.monsters.push(m);
}
function btSpawnPack(){
  BT.packs.push({x:60+Math.random()*(BT.W-120),y:60+Math.random()*(BT.H-120),heal:10+Math.floor(Math.random()*6)});
}
function btSetWeapon(i){
  if(!BT.player)return;
  BT.player.weapon=i;
  document.querySelectorAll('#battleWeapons .bw').forEach((b,ix)=>b.classList.toggle('active',ix===i));
  beep(430,.05,'triangle',.05);
}
function btShoot(){
  if(!BT.player||BT.paused)return;
  const p=BT.player, w=BT_W[p.weapon];
  if(p.energy<w.c){ beep(140,.08,'square',.05); return; }
  p.energy-=w.c;
  BT.bullets.push({x:p.x+p.dx*20,y:p.y+p.dy*20,vx:p.dx*460,vy:p.dy*460,w:p.weapon});
  beep(520,.06,'triangle',.07);
}
function btWall(){
  if(!BT.player||BT.paused||BT.wallCd>0||BT.walls.length>=3)return;
  const p=BT.player;
  if(p.energy<BT_WALL_E){ beep(140,.08,'square',.05); return; }
  p.energy-=BT_WALL_E;
  BT.wallCd=BT_WALL_CD;
  const len=120,px=p.x+p.dx*22,py=p.y+p.dy*22;
  const nx=-p.dy,ny=p.dx;
  BT.walls.push({x1:px+nx*20,y1:py+ny*20,x2:px-nx*20,y2:py-ny*20,th:9,t:BT.WALL_T});
  beep(240,.1,'triangle',.07);
}
function btFit(){
  const c=$('#battleCanvas'); if(!c)return;
  BT.dpr=Math.max(2,Math.min(3,window.devicePixelRatio||1));
  c.width=Math.round(BT.LW*BT.dpr); c.height=Math.round(BT.LH*BT.dpr);
}
function btStart(){
  btReset();
  btFit();
  BT.active=true;
  $('#battleIntroWrap').classList.add('hide');
  $('#battleGame').classList.remove('hide');
  $('#battleResult').classList.add('hide');
  btSetWeapon(0);
  if(!BT.raf){ BT.lastT=performance.now(); BT.raf=requestAnimationFrame(btLoop); }
}
async function btSaveRecord(survived){
  if(!BT.player)return;
  const dur=Math.max(1,Math.round((performance.now()-BT.startT)/1000));
  const payload={mode:'battle',ts:Date.now(),score:dur,duration:dur,kills:BT.kills,levelName:'点之对战',formula:'点之对战',hp:Math.max(0,Math.round(BT.player.hp)),survived:survived};
  history.unshift(payload);
  history=normalizeHistory(history);
  try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history));}catch(e){}
  try{ await fetch('/api/history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); }catch(err){}
  renderHistory();
}
function btExit(save){
  if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen();
  if(save&&BT.active&&BT.player){ btSaveRecord(true); toast('已保存本局对战记录'); }
  BT.active=false;
  if(BT.raf){cancelAnimationFrame(BT.raf);BT.raf=null;}
  BT.keys={};BT.paused=false;
  $('#battleGame').classList.add('hide');
  $('#battleIntroWrap').classList.remove('hide');
  $('#battleResult').classList.add('hide');
}
function btGameOver(){
  if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen();
  BT.active=false;
  if(BT.raf){cancelAnimationFrame(BT.raf);BT.raf=null;}
  const dur=Math.max(1,Math.round((performance.now()-BT.startT)/1000));
  btSaveRecord(false);
  $('#btRInfo').innerHTML=
    '<div class="row"><span>坚持时长</span><b>'+fmtDur(dur)+'</b></div>'+
    '<div class="row"><span>击杀怪物</span><b>'+BT.kills+' 只</b></div>'+
    '<div class="row"><span>结局</span><b style="color:var(--red)">血量耗尽</b></div>';
  beep(220,.3,'sawtooth',.07);setTimeout(()=>beep(160,.4,'sawtooth',.07),220);
  $('#battleResult').classList.remove('hide');
}
function btLoop(t){
  if(!BT.active)return;
  const dt=Math.min(0.05,(t-BT.lastT)/1000)||0.016; BT.lastT=t;
  const p=BT.player;
  if(BT.paused){ btDraw(); BT.raf=requestAnimationFrame(btLoop); return; }
  const mv=BT.mouse?Math.atan2(BT.mouse.cy-(p.y-BT.camY||0),BT.mouse.cx-(p.x-BT.camX||0)):0;
  let mx=0,my=0;
  if(BT.keys.KeyW||BT.keys.ArrowUp)my-=1;
  if(BT.keys.KeyS||BT.keys.ArrowDown)my+=1;
  if(BT.keys.KeyA||BT.keys.ArrowLeft)mx-=1;
  if(BT.keys.KeyD||BT.keys.ArrowRight)mx+=1;
  if(mx||my){ const l=Math.hypot(mx,my); mx=mx/l*215; my=my/l*215; }
  p.x=Math.max(p.r,Math.min(BT.W-p.r,p.x+mx*dt));
  p.y=Math.max(p.r,Math.min(BT.H-p.r,p.y+my*dt));
  if(BT.mouse){
    const wx=BT.camX+BT.mouse.cx, wy=BT.camY+BT.mouse.cy;
    const d=Math.max(0.001,Math.hypot(wx-p.x,wy-p.y));
    p.dx=(wx-p.x)/d; p.dy=(wy-p.y)/d;
  }
  btResolveWall(p,p.r);
  for(let i=BT.bullets.length-1;i>=0;i--){
    const b=BT.bullets[i];
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    if(b.x<0||b.x>BT.W||b.y<0||b.y>BT.H){BT.bullets.splice(i,1);continue;}
    let hit=false;
    for(const m of BT.monsters){
      if(Math.hypot(b.x-m.x,b.y-m.y)<m.r+5){ btApply(m,BT_W[b.w]); hit=true; break; }
    }
    if(!hit){
      for(const boss of BT.bosses){
        if(Math.hypot(b.x-boss.x,b.y-boss.y)<boss.r+5){
          btApply(boss,BT_W[b.w]);
          if(Math.abs(boss.val)<=BT_DEAD)btBossDie(boss);
          hit=true; break;
        }
      }
    }
    if(hit)BT.bullets.splice(i,1);
  }
  BT.spawnT-=dt;
  if(BT.mode!=='boss'&&BT.spawnT<=0&&BT.monsters.length<BT_MAX_M){ BT.spawnT=BT.spawnInt; btSpawnMonster(false); }
  BT.bossT-=dt;
  if(BT.bossT<=0){ BT.bossT=BT.mode==='boss'?BT_BOSS_INT_BS:BT.bossInt; if(BT.bosses.length<BT_MAX_BOSS)btSpawnBoss(); }
  for(const b of BT.bosses){
    b.chgT-=dt;
    const dB=Math.hypot(b.x-p.x,b.y-p.y);
    if(dB<520){
      const spd=52, jx=(Math.random()-0.5)*16, jy=(Math.random()-0.5)*16;
      b.vx=((p.x-b.x)/dB)*spd+jx; b.vy=((p.y-b.y)/dB)*spd+jy;
    }else if(b.chgT<=0){
      b.chgT=2+Math.random()*3; const a=Math.random()*Math.PI*2; b.vx=Math.cos(a)*40; b.vy=Math.sin(a)*40;
    }
    b.x=Math.max(b.r,Math.min(BT.W-b.r,b.x+b.vx*dt));
    b.y=Math.max(b.r,Math.min(BT.H-b.r,b.y+b.vy*dt));
    btResolveWall(b,b.r);
    b.atkT-=dt;
    if(b.atkT<=0&&dB<BT_ATK_RANGE+14){
      b.atkT=BT_ATK_CD;
      if(p.invT<=0){ p.hp-=BT_BOSS_DMG; p.atkFlash=0.5; p.invT=0.3; beep(140,.15,'sawtooth',.09); }
      if(p.hp<=0){ btGameOver(); return; }
    }
  }
  for(const m of BT.monsters){
    const dP=Math.max(0.001,Math.hypot(m.x-p.x,m.y-p.y));
    if(dP<430){
      const spd=78, jx=(Math.random()-0.5)*24, jy=(Math.random()-0.5)*24;
      m.vx=((p.x-m.x)/dP)*spd+jx; m.vy=((p.y-m.y)/dP)*spd+jy;
    }else if(m.chgT<=0){
      m.chgT=2+Math.random()*3;
      const a=Math.random()*Math.PI*2;
      m.vx=Math.cos(a)*40; m.vy=Math.sin(a)*40;
    }
    m.x=Math.max(m.r,Math.min(BT.W-m.r,m.x+m.vx*dt));
    m.y=Math.max(m.r,Math.min(BT.H-m.r,m.y+m.vy*dt));
    btResolveWall(m,m.r);
    m.chgT-=dt;
    m.atkT-=dt;
    if(m.atkT<=0&&dP<BT_ATK_RANGE){
      m.atkT=BT_ATK_CD;
      if(p.invT<=0){ p.hp-=BT_DMG; p.atkFlash=0.4; p.invT=0.3; beep(180,.12,'sawtooth',.08); }
      if(p.hp<=0){ btGameOver(); return; }
    }
  }
  for(let i=BT.monsters.length-1;i>=0;i--){
    if(Math.abs(BT.monsters[i].val)<=BT_DEAD){ BT.monsters.splice(i,1); BT.kills++; btSpawnMonster(false); }
  }
  for(let i=BT.walls.length-1;i>=0;i--){ BT.walls[i].t-=dt; if(BT.walls[i].t<=0)BT.walls.splice(i,1); }
  BT.wallCd=Math.max(0,BT.wallCd-dt);
  BT.packT-=dt;
  if(BT.packT<=0){ BT.packT=BT.packInt; if(BT.packs.length<2)btSpawnPack(); }
  for(let i=BT.packs.length-1;i>=0;i--){
    const pk=BT.packs[i];
    if(Math.hypot(pk.x-p.x,pk.y-p.y)<p.r+14){ p.hp=Math.min(BT.hpMax,p.hp+pk.heal); BT.packs.splice(i,1); beep(660,.08,'sine',.07); }
  }
  p.invT=Math.max(0,p.invT-dt);
  p.atkFlash=Math.max(0,p.atkFlash-dt);
  if(p.energy<=BT_RECHARGE_E&&!BT.recharging){ BT.recharging=true; BT.rechargeT=BT_RECHARGE_T; }
  if(BT.recharging){
    BT.rechargeT-=dt;
    if(BT.rechargeT<=0){ p.energy=BT.maxE; BT.recharging=false; beep(660,.12,'sine',.07); }
  }
  const hpTxt='❤ '+Math.max(0,Math.round(p.hp));
  $('#btHP').textContent=hpTxt;
  $('#btHPFs').textContent=hpTxt;
  $('#btHPBarFs').style.width=(Math.max(0,p.hp)/BT.hpMax*100)+'%';
  $('#btTime').textContent=fmtDur((t-BT.startT)/1000);
  $('#btTimeFs').textContent=fmtDur((t-BT.startT)/1000);
  $('#btKills').textContent='☠ '+BT.kills;
  $('#btKillsFs').textContent='☠ '+BT.kills;
  const ep=Math.max(0,p.energy)/BT.maxE*100;
  $('#btEBar').style.width=ep+'%';
  $('#btEBarFs').style.width=ep+'%';
  const eTxt=BT.recharging?('⚡ 回能 '+Math.ceil(BT.rechargeT)+'s'):('⚡ '+Math.max(0,Math.round(p.energy)));
  $('#btEnergy').textContent=eTxt;
  $('#btEnergyFs').textContent=eTxt;
  btDraw();
  BT.raf=requestAnimationFrame(btLoop);
}
function btDraw(){
  const c=$('#battleCanvas'); if(!c||!BT.player)return;
  const ctx=c.getContext('2d');
  const W=BT.LW,H=BT.LH,dpr=BT.dpr||1,p=BT.player;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const camX=Math.max(0,Math.min(BT.W-W,p.x-W/2));
  const camY=Math.max(0,Math.min(BT.H-H,p.y-H/2));
  BT.camX=camX; BT.camY=camY;
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  ctx.fillStyle=isDark?'#0f1420':'#eef1f7';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle=isDark?'rgba(255,255,255,.05)':'rgba(15,20,40,.06)';
  ctx.lineWidth=1;
  const gs=80;
  for(let x=Math.floor(camX/gs)*gs;x<camX+W;x+=gs){ctx.beginPath();ctx.moveTo(x-camX,0);ctx.lineTo(x-camX,H);ctx.stroke();}
  for(let y=Math.floor(camY/gs)*gs;y<camY+H;y+=gs){ctx.beginPath();ctx.moveTo(0,y-camY);ctx.lineTo(W,y-camY);ctx.stroke();}
  const sx=x=>x-camX, sy=y=>y-camY;
  ctx.strokeStyle='rgba(79,70,229,.5)';ctx.lineWidth=3;ctx.setLineDash([10,8]);
  ctx.strokeRect(-camX,-camY,BT.W,BT.H);ctx.setLineDash([]);
  for(const k of BT.packs){
    const x=sx(k.x),y=sy(k.y);
    ctx.fillStyle='rgba(34,197,94,.16)';ctx.beginPath();ctx.arc(x,y,16,0,7);ctx.fill();
    ctx.fillStyle='#22c55e';ctx.fillRect(x-9,y-3,18,6);ctx.fillRect(x-3,y-9,6,18);
    ctx.fillStyle=isDark?'#cde0ff':'#234';ctx.font='bold 10px sans-serif';ctx.textAlign='center';
    ctx.fillText('+'+k.heal,x,y-22);
  }
  for(const w of BT.walls){
    ctx.strokeStyle='rgba(99,102,241,.9)';ctx.lineWidth=w.th;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(sx(w.x1),sy(w.y1));ctx.lineTo(sx(w.x2),sy(w.y2));ctx.stroke();
  }
  for(const m of BT.monsters){
    const x=sx(m.x),y=sy(m.y);
    const col=m.val>0?'#ef4444':'#3b82f6';
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,m.r,0,7);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(x-4,y-3,1.3,0,7);ctx.arc(x+4,y-3,1.3,0,7);ctx.fill();
    ctx.font='bold 12px -apple-system,"PingFang SC",sans-serif';ctx.textAlign='center';
    ctx.fillStyle=isDark?'#eef1f7':'#1f2430';
    ctx.fillText(m.formula,x,y-m.r-8);
    if(m.atkT<0.25){ ctx.strokeStyle='rgba(255,80,80,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,m.r+6,0,7);ctx.stroke(); }
  }
  for(const b of BT.bosses){
    const x=sx(b.x),y=sy(b.y),col='#a855f7';
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,b.r,0,7);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#fbbf24';
    ctx.beginPath();
    ctx.moveTo(x-12,y-b.r+4);ctx.lineTo(x-12,y-b.r-8);ctx.lineTo(x-5,y-b.r+1);ctx.lineTo(x,y-b.r-9);ctx.lineTo(x+5,y-b.r+1);ctx.lineTo(x+12,y-b.r-8);ctx.lineTo(x+12,y-b.r+4);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(x-6,y-4,3.5,0,7);ctx.arc(x+6,y-4,3.5,0,7);ctx.fill();
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(x-6,y-4,1.8,0,7);ctx.arc(x+6,y-4,1.8,0,7);ctx.fill();
    const bw=b.r*2.4,bx=x-bw/2,by=y-b.r-34;
    ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(bx,by,bw,6);
    ctx.fillStyle='#f43f5e';ctx.fillRect(bx,by,bw*Math.max(0,Math.min(1,b.val/b.hpMax)),6);
    ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1;ctx.strokeRect(bx,by,bw,6);
    ctx.font='bold 15px -apple-system,"PingFang SC",sans-serif';ctx.textAlign='center';
    const hpTxt=Math.abs(b.val-Math.round(b.val))<0.01?String(Math.round(b.val)):(Math.round(b.val*100)/100);
    ctx.fillStyle='#fff';ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=4;
    ctx.strokeText(hpTxt,x,y-b.r-18);ctx.fillText(hpTxt,x,y-b.r-18);
    if(b.atkT<0.25){ ctx.strokeStyle='rgba(255,80,80,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,b.r+8,0,7);ctx.stroke(); }
  }
  for(const b of BT.bullets){
    ctx.fillStyle='#f59e0b';ctx.beginPath();ctx.arc(sx(b.x),sy(b.y),4,0,7);ctx.fill();
    ctx.strokeStyle='rgba(245,158,11,.4)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(sx(b.x),sy(b.y));ctx.lineTo(sx(b.x-b.vx*0.03),sy(b.y-b.vy*0.03));ctx.stroke();
  }
  const px=sx(p.x),py=sy(p.y);
  ctx.fillStyle='#4f46e5';ctx.beginPath();ctx.arc(px,py,p.r,0,7);ctx.fill();
  ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.stroke();
  ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+p.dx*22,py+p.dy*22);ctx.stroke();
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.arc(px+p.dx*27,py+p.dy*27,4,0,7);ctx.fill();
  if(p.atkFlash>0){
    ctx.fillStyle='rgba(239,68,68,'+Math.min(1,p.atkFlash*1.8)+')';
    ctx.beginPath();ctx.arc(px,py,p.r+9,0,7);ctx.fill();
  }
  const offTgts=[];
  for(const b of BT.bosses)offTgts.push({x:b.x,y:b.y,r:b.r,col:'#a855f7'});
  for(const m of BT.monsters)offTgts.push({x:m.x,y:m.y,r:m.r,col:m.val>0?'#ef4444':'#3b82f6'});
  const mgn=26;
  for(const tg of offTgts){
    const sx2=tg.x-camX, sy2=tg.y-camY;
    if(sx2>=-tg.r&&sx2<=W+tg.r&&sy2>=-tg.r&&sy2<=H+tg.r)continue;
    const dx=sx2-W/2, dy=sy2-H/2;
    if(!dx&&!dy)continue;
    let t=1e9;
    if(dx>0)t=Math.min(t,(W-mgn-W/2)/dx);
    else if(dx<0)t=Math.min(t,(mgn-W/2)/dx);
    if(dy>0)t=Math.min(t,(H-mgn-H/2)/dy);
    else if(dy<0)t=Math.min(t,(mgn-H/2)/dy);
    const ix=W/2+dx*t, iy=H/2+dy*t;
    ctx.save();
    ctx.translate(ix,iy);
    ctx.rotate(Math.atan2(dy,dx));
    ctx.globalAlpha=.22;
    ctx.fillStyle=tg.col;
    ctx.beginPath();ctx.arc(0,0,12,0,7);ctx.fill();
    ctx.globalAlpha=1;
    ctx.fillStyle=tg.col;
    ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-3,-3.5);ctx.lineTo(-3,3.5);ctx.closePath();ctx.fill();
    ctx.restore();
  }
  if(BT.paused){
    ctx.fillStyle='rgba(10,14,24,.55)';
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff';
    ctx.font='bold 26px -apple-system,"PingFang SC",sans-serif';
    ctx.textAlign='center';
    ctx.fillText('⏸ 已暂停',W/2,H/2-8);
    ctx.font='14px -apple-system,"PingFang SC",sans-serif';
    ctx.fillStyle='rgba(255,255,255,.75)';
    ctx.fillText('按空格继续',W/2,H/2+24);
  }
}
$('#battleQuitBtn').addEventListener('click',()=>btExit(true));
document.querySelectorAll('#battleModes .bm').forEach(b=>{
  b.addEventListener('click',e=>{
    const m=b.dataset.mode;
    document.querySelectorAll('#battleModes .bm').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    BT.mode=m;
    if(e.target.closest('.bm-start')){
      if(m==='custom'){ openCustomDlg(); return; }
      btStart();
      return;
    }
    beep(430,.05,'triangle',.05);
  });
});
const CUST_DEF={pack:10,spawn:4,boss:300,hp:100,energy:250};
const custFields=[['#custPack','pack','s'],['#custSpawn','spawn','s'],['#custBoss','boss','s'],['#custHp','hp',''],['#custEnergy','energy','']];
function custSync(r){
  const v=Number($(r).value),u=$(r).dataset.u;
  $(r+'V').textContent=(u==='s'?v+'s':v);
}
function openCustomDlg(){
  const c=Object.assign({},CUST_DEF,BT.custom||{});
  custFields.forEach(([r,k])=>{ $(r).value=c[k]; $(r).dataset.u=(r==='#custHp'||r==='#custEnergy')?'':'s'; custSync(r); });
  $('#customDlg').classList.remove('hide');
}
custFields.forEach(([r])=>$(r).addEventListener('input',()=>custSync(r)));
$('#custCancelBtn').addEventListener('click',()=>{
  $('#customDlg').classList.add('hide');
  document.querySelectorAll('#battleModes .bm').forEach(x=>x.classList.toggle('active',x.dataset.mode==='classic'));
  BT.mode='classic';
});
$('#custStartBtn').addEventListener('click',()=>{
  BT.custom={pack:+$('#custPack').value,spawn:+$('#custSpawn').value,boss:+$('#custBoss').value,hp:+$('#custHp').value,energy:+$('#custEnergy').value};
  BT.mode='custom';
  $('#customDlg').classList.add('hide');
  btStart();
});
$('#btRetryBtn').addEventListener('click',()=>{ $('#battleResult').classList.add('hide'); btStart(); });
$('#btMenuBtn').addEventListener('click',()=>{ $('#battleResult').classList.add('hide'); btExit(); });
$('#battleWeapons').addEventListener('click',e=>{
  const b=e.target.closest('.bw'); if(!b)return;
  btSetWeapon(Number(b.dataset.w));
});
const btCanvasEl=$('#battleCanvas');
btCanvasEl.addEventListener('mousemove',e=>{
  if(!BT.active)return;
  const r=btCanvasEl.getBoundingClientRect();
  const sc=Math.max(1e-6,Math.min(r.width/BT.LW,r.height/BT.LH));
  const cw=BT.LW*sc, ch=BT.LH*sc, ox=(r.width-cw)/2, oy=(r.height-ch)/2;
  BT.mouse={cx:(e.clientX-r.left-ox)/cw*BT.LW, cy:(e.clientY-r.top-oy)/ch*BT.LH};
});
btCanvasEl.addEventListener('mousedown',e=>{
  if(!BT.active)return;
  if(e.button===0){ e.preventDefault(); btShoot(); }
});
btCanvasEl.addEventListener('wheel',e=>{
  if(!BT.active||!document.fullscreenElement)return;
  e.preventDefault();
  const dir=e.deltaY<0?-1:1;
  btSetWeapon((BT.player.weapon+dir+BT_W.length)%BT_W.length);
},{passive:false});
$('#btFullBtn').addEventListener('click',()=>{
  const st=$('#battleStage');
  if(!st)return;
  if(document.fullscreenElement)document.exitFullscreen();
  else if(st.requestFullscreen)st.requestFullscreen();
});
document.addEventListener('keydown',e=>{
  if(!BT.active)return;
  const k=e.code;
  if(k==='Space'){e.preventDefault(); BT.paused=!BT.paused; beep(BT.paused?320:520,.07,'triangle',.06);}
  else if(k==='KeyE'){e.preventDefault();btWall();}
  else if(k==='Digit1')btSetWeapon(0);
  else if(k==='Digit2')btSetWeapon(1);
  else if(k==='Digit3')btSetWeapon(2);
  else if(k==='Digit4')btSetWeapon(3);
  else if(k.indexOf('Arrow')===0)e.preventDefault();
  BT.keys[k]=true;
});
document.addEventListener('keyup',e=>{ BT.keys[e.code]=false; });
/* ===== 🃏 24 点挑战（Make 24）===== */
const G24={active:false,mode:'std',cards:[],one:null,two:null,op:null,step:0,orig:[],startT:0,timer:null,snaps:[],solved:false,_fn:null};
const G24_RANK={A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13};
const G24_DECK=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const G24_SUITS=['♠','♥','♦','♣'];
function g24Gcd(a,b){ a=Math.abs(a);b=Math.abs(b); while(b){const t=a%b;a=b;b=t;} return a||1; }
function g24Frac(p,q){
  if(q===0)return null;
  if(q<0){p=-p;q=-q;}
  const g=g24Gcd(p,q);
  return {p:p/g,q:q/g};
}
function g24Disp(p,q,root){
  if(root>0){
    if(p===1){
      if(q===1)return '\\sqrt{'+root+'}';
      return '\\frac{\\sqrt{'+root+'}}{'+q+'}';
    }
    if(q===1)return p+'\\sqrt{'+root+'}';
    return '\\frac{'+p+'\\sqrt{'+root+'}}{'+q+'}';
  }
  if(q===1)return String(p);
  let d=Math.abs(q);
  while(d%2===0)d/=2;
  while(d%5===0)d/=5;
  if(d===1){ const v=p/q; return String(Math.round(v*1e6)/1e6); }
  return '\\frac{'+p+'}{'+q+'}';
}
function g24CanMake(vals){
  if(vals.length===1)return Math.abs(vals[0]-24)<1e-6;
  for(let i=0;i<vals.length;i++){
    for(let j=i+1;j<vals.length;j++){
      const rest=vals.filter((_,k)=>k!==i&&k!==j);
      const a=vals[i],b=vals[j],next=[a+b,a-b,b-a,a*b];
      if(Math.abs(b)>1e-9)next.push(a/b);
      if(Math.abs(a)>1e-9)next.push(b/a);
      for(const v of next){ if(g24CanMake([...rest,v]))return true; }
    }
  }
  return false;
}
function g24Deal(){
  for(let t=0;t<300;t++){
    const ranks=[];
    for(let i=0;i<4;i++)ranks.push(G24_DECK[Math.floor(Math.random()*G24_DECK.length)]);
    if(g24CanMake(ranks.map(r=>G24_RANK[r])))return ranks;
  }
  return ['3','3','8','8'];
}
function g24Combine(a,b,op){
  if(op==='+'){
    if((a.root||0)+(b.root||0)>0){
      const v=a.val+b.val;
      const np=Math.round(v*1e6);
      return {p:np,q:1e6,val:v,disp:g24Disp(np,1e6,0),root:0};
    }
    const r=g24Frac(a.p*b.q+b.p*a.q,a.q*b.q); if(!r)return null;
    return {p:r.p,q:r.q,val:r.p/r.q,disp:g24Disp(r.p,r.q,0),root:0};
  }
  if(op==='-'){
    if((a.root||0)+(b.root||0)>0){
      const v=a.val-b.val;
      const np=Math.round(v*1e6);
      return {p:np,q:1e6,val:v,disp:g24Disp(np,1e6,0),root:0};
    }
    const r=g24Frac(a.p*b.q-b.p*a.q,a.q*b.q); if(!r)return null;
    return {p:r.p,q:r.q,val:r.p/r.q,disp:g24Disp(r.p,r.q,0),root:0};
  }
  if(op==='*'){
    if(a.root&&b.root){
      const n=a.root*b.root;
      const s=Math.sqrt(n);
      if(Number.isInteger(s))return{p:s,q:1,val:s,disp:String(s),root:0};
      return {p:1,q:1,val:Math.sqrt(n),disp:g24Disp(1,1,n),root:n};
    }
    if(a.root&&!b.root){
      return {p:b.p,q:b.q,val:a.val*b.val,disp:g24Disp(b.p,b.q,a.root),root:a.root};
    }
    if(!a.root&&b.root){
      return {p:a.p,q:a.q,val:a.val*b.val,disp:g24Disp(a.p,a.q,b.root),root:b.root};
    }
    const r=g24Frac(a.p*b.p,a.q*b.q); if(!r)return null;
    return {p:r.p,q:r.q,val:r.p/r.q,disp:g24Disp(r.p,r.q,0),root:0};
  }
  if(op==='/'){
    if(b.p===0)return null;
    if(a.root){
      return {p:b.q,q:b.p,val:a.val/b.val,disp:g24Disp(b.q,b.p,a.root),root:a.root};
    }
    if(b.root){
      const g=g24Gcd(a.p,a.q*b.root);
      const newP=a.p/g, newQ=a.q*b.root/g;
      return {p:newP,q:newQ,val:a.val/b.val,disp:g24Disp(newP,newQ,b.root),root:b.root};
    }
    const r=g24Frac(a.p*b.q,a.q*b.p); if(!r)return null;
    return {p:r.p,q:r.q,val:r.p/r.q,disp:g24Disp(r.p,r.q,0),root:0};
  }
  if(op==='sqrt'){
    if(a.q!==1||a.p<0||a.root>0)return null;
    const s=Math.sqrt(a.p);
    if(Number.isInteger(s))return {p:s,q:1,val:s,disp:String(s),root:0};
    return {p:a.p,q:1,val:s,disp:'\\sqrt{'+a.p+'}',root:a.p};
  }
  if(op==='!'){
    if(a.q!==1||a.p<0||a.p>24||a.root>0)return null;
    let f=1; for(let i=2;i<=a.p;i++)f*=i;
    if(f<=362880)return {p:f,q:1,val:f,disp:String(f),root:0};
    return {p:f,q:1,val:f,disp:a.p+'!',root:0};
  }
  return null;
}

G24._fn={combine:g24Combine,canMake:g24CanMake,deal:g24Deal,tryOp:g24TryOp,undo:g24Undo,latex:g24LatexHtml};
function g24LatexHtml(s){
  const out=[];
  let i=0;
  function readGroup(){
    let depth=1,j=i+1;
    while(depth>0&&j<s.length){
      if(s[j]==='{')depth++;
      else if(s[j]==='}')depth--;
      if(depth===0)break;
      j++;
    }
    const inner=s.slice(i+1,j); i=j+1;
    return inner;
  }
  while(i<s.length){
    if(s.startsWith('\\frac{',i)){
      i+=5; const num=readGroup();
      let html='<span class="gfrac"><i>'+g24LatexHtml(num)+'</i>';
      if(s[i]==='{'){ const den=readGroup(); html+='<i>'+g24LatexHtml(den)+'</i>'; }
      html+='</span>'; out.push(html);
    }else if(s.startsWith('\\sqrt{',i)){
      i+=5; const inner=readGroup();
      out.push('<span class="gsqrt">√<span class="groot">'+g24LatexHtml(inner)+'</span></span>');
    }else{ out.push(s[i]); i++; }
  }
  return out.join('');
}
function g24Render(){
  const box=$('#g24Cards'); if(!box)return;
  box.innerHTML=G24.cards.map((c,i)=>{
    let cls='g24-card'+(c.synth?' synth':'')+(c.suit==='♥'||c.suit==='♦'?' red':'');
    if(i===G24.one)cls+=' one';
    if(i===G24.two)cls+=' two';
    const body=(c.disp.indexOf('\\frac')>=0||c.disp.indexOf('\\sqrt')>=0)?g24LatexHtml(c.disp):escapeHtml(c.disp);
    return '<div class="'+cls+'" data-i="'+i+'">'+body+(c.suit?'<br><span style="font-size:14px">'+c.suit+'</span>':'')+'</div>';
  }).join('');
  $('#g24Left').textContent=G24.cards.length+' 张牌';
  const ops=$('#g24Ops'); if(ops){
    ops.querySelectorAll('.g24-op').forEach(b=>{ b.classList.toggle('pending',G24.op===b.dataset.op); });
  }
}
function g24ApplyMode(){
  const ops=$('#g24Ops'); if(!ops)return;
  ops.querySelectorAll('.g24-op').forEach(b=>{
    b.classList.toggle('hide',G24.mode==='basic'&&(b.dataset.op==='sqrt'||b.dataset.op==='!'));
  });
}
function g24Log(text){
  const box=$('#g24Log'); if(!box)return;
  const d=document.createElement('div');
  d.className='g24-line';
  d.innerHTML='<b>第 '+G24.step+' 步</b><span>'+text+'</span>';
  box.prepend(d);
}
function g24Save(solved,dur){
  const payload={mode:'g24',ts:Date.now(),score:dur,duration:dur,solved:solved,steps:G24.step,cards:G24.orig.join(' '),expr:solved?G24.cards[0].disp:'',levelName:'24点挑战',formula:solved?'解出 24':'未解出'};
  history.unshift(payload);
  history=normalizeHistory(history);
  try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history));}catch(e){}
  fetch('/api/history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(()=>{});
  renderHistory();
}
function g24Win(){
  if(G24.timer){clearInterval(G24.timer);G24.timer=null;}
  G24.active=false;G24.solved=true;
  const dur=Math.max(1,Math.round((Date.now()-G24.startT)/1000));
  g24Save(true,dur);
  $('#g24Time').textContent=fmtDur(dur);
  $('#g24RInfo').innerHTML=
    '<div class="row"><span>用时</span><b>'+fmtDur(dur)+'</b></div>'+
    '<div class="row"><span>步数</span><b>'+G24.step+' 步</b></div>'+
    '<div class="row"><span>最终结果</span><b style="color:var(--accent)">24</b></div>';
  $('#g24Result').classList.remove('hide');
  beep(660,.15,'sine',.08);setTimeout(()=>beep(880,.2,'sine',.08),150);
}
function g24TryOp(op){
  if(!G24.active)return;
  const isUnary=(op==='sqrt'||op==='!');
  const aIdx=G24.one,bIdx=isUnary?null:G24.two;
  if(aIdx===null||(!isUnary&&bIdx===null)){ toast(isUnary?'请先选择一张牌作为数字 1':'请先选择数字 1 与数字 2'); return; }
  const a=G24.cards[aIdx];
  const b=isUnary?a:G24.cards[bIdx];
  const res=g24Combine(a,b,op);
  if(!res){ toast('⚠ 该运算无效（除 0 / 负数开方 / 非整数或 >24 无法阶乘）'); G24.op=null; g24Render(); return; }
  G24.snaps.push(G24.cards.map(c=>({...c})));
  const newCards=G24.cards.map(c=>({...c}));
  newCards[aIdx]={p:res.p,q:res.q,val:res.val,disp:res.disp,root:res.root||0,synth:true,suit:null};
  if(!isUnary)newCards.splice(bIdx,1);
  G24.cards=newCards;
  G24.step++;
  G24.one=null;G24.two=null;G24.op=null;
  const opTxt={'+':'＋','-':'－','*':'×','/':'÷',sqrt:'√','!':'!'}[op];
  g24Log(g24LatexHtml(escapeHtml(a.disp))+' '+opTxt+(isUnary?'':' '+g24LatexHtml(escapeHtml(b.disp)))+' = <b>'+g24LatexHtml(escapeHtml(res.disp))+'</b>');
  if(newCards.length===1){
    const v=newCards[0].val;
    const win=(Math.abs(v-24)<1e-4)||(Math.round(v)===24);
    if(win){
      newCards[0].p=24; newCards[0].q=1; newCards[0].val=24; newCards[0].disp='24';
      g24Render(); g24Win(); return;
    }
    toast('剩 1 张 = '+newCards[0].disp+'，不等于 24');
  }
  g24Render();
}
function g24Undo(){
  if(!G24.active)return;
  if(!G24.snaps.length){ toast('没有可撤销的步骤'); return; }
  G24.cards=G24.snaps.pop();
  G24.step=Math.max(0,G24.step-1);
  G24.one=null;G24.two=null;G24.op=null;
  g24Render();
}
function g24Pick(i){
  if(G24.one===null){ G24.one=i; }
  else if(G24.two===null){
    if(G24.one===i){ G24.one=null; }
    else{
      G24.two=i;
      if(G24.op){ const op=G24.op; G24.op=null; g24TryOp(op); return; }
    }
  }else{
    G24.one=i; G24.two=null;
  }
  g24Render();
}
function g24Op(op){
  if(!G24.active)return;
  const isUnary=(op==='sqrt'||op==='!');
  if(G24.one===null){ toast('请先选择一张牌作为数字 1'); return; }
  if(isUnary){ g24TryOp(op); return; }
  if(G24.two!==null){ g24TryOp(op); return; }
  G24.op=op;
  toast('已选 '+{'+':'＋','-':'－','*':'×','/':'÷'}[op]+'，请选择数字 2');
  g24Render();
}
function g24Start(){
  const ranks=g24Deal();
  G24.cards=ranks.map(r=>{ const v=G24_RANK[r]; return {p:v,q:1,val:v,disp:String(v),root:0,rank:r,suit:G24_SUITS[Math.floor(Math.random()*4)],synth:false}; });
  G24.orig=ranks.slice();
  G24.one=null;G24.two=null;G24.op=null;G24.step=0;G24.snaps=[];G24.solved=false;
  G24.startT=Date.now();
  if(G24.timer)clearInterval(G24.timer);
  G24.timer=setInterval(()=>{ const el=$('#g24Time'); if(el)el.textContent=fmtDur((Date.now()-G24.startT)/1000); },250);
  $('#g24Time').textContent='00:00';
  $('#g24Step').textContent='第 1 步';
  const log=$('#g24Log'); if(log)log.innerHTML='';
  g24ApplyMode();
  $('#g24Intro').classList.add('hide');
  $('#g24Game').classList.remove('hide');
  $('#g24Result').classList.add('hide');
  G24.active=true;
  g24Render();
  toast('🃏 发牌！请合成 24');
}
function g24Exit(){
  if(G24.timer){clearInterval(G24.timer);G24.timer=null;}
  if(G24.active&&G24.step>0){
    const dur=Math.max(1,Math.round((Date.now()-G24.startT)/1000));
    g24Save(false,dur);
    toast('已保存本局 24 点记录');
  }
  G24.active=false;
  $('#g24Game').classList.add('hide');
  $('#g24Intro').classList.remove('hide');
  $('#g24Result').classList.add('hide');
}
$('#g24Cards').addEventListener('click',e=>{
  if(!G24.active)return;
  const el=e.target.closest('.g24-card'); if(!el)return;
  g24Pick(Number(el.dataset.i));
});
$('#g24Ops').addEventListener('click',e=>{
  if(!G24.active)return;
  const b=e.target.closest('.g24-op'); if(!b)return;
  g24Op(b.dataset.op);
});
$('#g24UndoBtn').addEventListener('click',g24Undo);
$('#g24RestartBtn').addEventListener('click',()=>{ if(G24.timer){clearInterval(G24.timer);G24.timer=null;} g24Start(); });
$('#g24QuitBtn').addEventListener('click',()=>g24Exit());
document.querySelectorAll('#g24Modes .bm').forEach(b=>{
  b.addEventListener('click',e=>{
    const m=b.dataset.g24mode;
    document.querySelectorAll('#g24Modes .bm').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    G24.mode=m;
    if(e.target.closest('.bm-start')){ g24Start(); return; }
    beep(430,.05,'triangle',.05);
  });
});
$('#g24AgainBtn').addEventListener('click',()=>{ $('#g24Result').classList.add('hide'); g24Start(); });
$('#g24BackBtn').addEventListener('click',()=>{ $('#g24Result').classList.add('hide'); g24Exit(); });
renderAxisMgrid();
})();
