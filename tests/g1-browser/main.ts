import type { MatchResult, PublicFrame } from '../../packages/contracts/src/index.js';
const byId=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=byId<HTMLCanvasElement>('arena'),ctx=canvas.getContext('2d')!,run=byId<HTMLButtonElement>('run'),parity=byId<HTMLButtonElement>('parity'),play=byId<HTMLButtonElement>('play'),home=byId<HTMLButtonElement>('home'),slider=byId<HTMLInputElement>('timeline'),status=byId('status');
let frames:PublicFrame[]=[],playing=false,last=0,fraction=0,worker:Worker|undefined;
function draw():void {
  const frame=frames[Number(slider.value)];ctx.clearRect(0,0,1000,700);ctx.save();ctx.translate(500,350);ctx.scale(25,-25);
  ctx.lineWidth=.04;ctx.strokeStyle='#43556b';for(let x=-20;x<=20;x++){ctx.beginPath();ctx.moveTo(x,-14);ctx.lineTo(x,14);ctx.stroke();}for(let y=-14;y<=14;y++){ctx.beginPath();ctx.moveTo(-20,y);ctx.lineTo(20,y);ctx.stroke();}
  ctx.strokeStyle='#d9b565';ctx.lineWidth=.08;ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.stroke();
  if(frame){if(frame.ringRadius<25000){ctx.strokeStyle='#ef726c';ctx.beginPath();ctx.arc(0,0,frame.ringRadius/1000,0,Math.PI*2);ctx.stroke();}
    for(const id of ['A','B'] as const){const a=frame.actors[id],core=a.modules.find(m=>m.catalogId==='core')!,color=id==='A'?'#63ddcf':'#ff9c7a';ctx.save();ctx.translate(a.pose.x/1000,a.pose.y/1000);ctx.rotate(a.pose.heading*Math.PI/2048);
      for(const m of a.modules){if(m.status!=='alive')continue;const x=m.x-core.x-1,y=m.y-core.y-1,size=m.catalogId==='core'?2:1;
        ctx.fillStyle=m.catalogId==='armor'?'#778a9c':color;ctx.globalAlpha=m.hp===0?0:.75;ctx.fillRect(x+.05,y+.05,size-.1,size-.1);ctx.globalAlpha=1;ctx.strokeStyle=m.phase==='windup'?'#ffdc62':color;ctx.lineWidth=m.phase==='windup'?.14:.04;ctx.strokeRect(x+.04,y+.04,size-.08,size-.08);
        ctx.save();ctx.translate(x+size/2,y+size/2);ctx.scale(1,-1);ctx.font='.42px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#0c131c';ctx.fillText(m.catalogId==='core'?'C':m.catalogId==='thruster'?'T':m.catalogId==='blade'?'B':m.catalogId==='burst'?'U':m.catalogId==='shield'?'S':m.catalogId==='radiator'?'R':m.catalogId==='capacitor'?'E':'A',0,0);ctx.restore();
        if(m.catalogId==='blade'&&m.phase==='active'){ctx.save();ctx.translate(x+.5,y+.5);ctx.rotate(m.orientation*Math.PI/2);ctx.translate(.501,0);ctx.fillStyle='#f4dd93';ctx.globalAlpha=.4;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,1.5,-Math.PI/4,Math.PI/4);ctx.closePath();ctx.fill();ctx.restore();}
        if(m.shield){const squared=Math.max(...a.modules.flatMap(n=>{const size=n.catalogId==='core'?2:1;return [0,size].flatMap(dx=>[0,size].map(dy=>(n.x-core.x-1+dx)**2+(n.y-core.y-1+dy)**2));})),radius=Math.ceil(Math.sqrt(squared)*1000)/1000+.25;ctx.strokeStyle='#c89aff';ctx.lineWidth=.15;ctx.beginPath();ctx.arc(0,0,radius,m.orientation*Math.PI/2-Math.PI/4,m.orientation*Math.PI/2+Math.PI/4);ctx.stroke();}
      }ctx.restore();byId(`hp${id}`).textContent=`${id} · Core ${core.hp} HP · Control ${a.controlTicks}`;
    }
    ctx.fillStyle='#f9e4a0';for(const p of frame.projectiles){ctx.beginPath();ctx.arc(p.x/1000,p.y/1000,.09,0,Math.PI*2);ctx.fill();}
    byId('clock').textContent=`${(frame.boundary/60).toFixed(2)} s · tick ${frame.boundary}`;
    const list=byId('events');list.replaceChildren();for(const event of frame.events){const li=document.createElement('li');li.textContent=`${event.actor}: ${event.kind} ${event.value||''}`;list.append(li);}
  }ctx.restore();
}
function stop():void {playing=false;play.textContent='Phát lại';}
function startWorker(kind:'match'|'parity'):void {
  worker?.terminate();worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});run.disabled=parity.disabled=true;stop();status.textContent=kind==='match'?'Đang tính trận trong worker…':'Đang đối chiếu corpus…';
  worker.onerror=event=>{status.textContent=`Worker lỗi: ${event.message}. Có thể thử lại.`;run.disabled=parity.disabled=false;};
  worker.onmessage=e=>{const data=e.data;if(data.kind==='progress'){status.textContent=`Đối chiếu browser: ${data.count}/${data.total}`;return;}
    run.disabled=parity.disabled=false;if(data.kind==='error'){status.textContent=data.message;return;}
    if(data.kind==='parity'){status.textContent=`PASS: ${data.records.length} seed trong browser worker.`;(window as unknown as {g1Parity:unknown}).g1Parity=data;return;}
    frames=data.frames;slider.max=String(frames.length-1);slider.value='0';play.disabled=home.disabled=false;
    const result=data.result as MatchResult;byId('result').textContent=`Kết quả: ${result.winner} · ${result.cause} · ${(result.elapsedTicks/60).toFixed(2)} s\nĐiểm A ${result.scores.A} / B ${result.scores.B}`;status.textContent='Trận đã tính — phát lại. Tua để xem windup/hit/module mất.';draw();
    (window as unknown as {g1Frames:PublicFrame[]}).g1Frames=frames;
    (window as unknown as {g1Codec:unknown}).g1Codec=data.codec;
  };
  worker.postMessage({kind,a:byId<HTMLSelectElement>('botA').selectedIndex,b:byId<HTMLSelectElement>('botB').selectedIndex,passive:byId<HTMLSelectElement>('brainA').value==='passive'});
}
run.onclick=()=>startWorker('match');parity.onclick=()=>startWorker('parity');play.onclick=()=>{playing=!playing;play.textContent=playing?'Dừng':'Phát lại';last=0;};home.onclick=()=>{stop();slider.value='0';draw();};slider.oninput=()=>{stop();draw();};
document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLButtonElement)return;if(e.code==='Space'&&!play.disabled){e.preventDefault();play.click();}if(e.code==='Home'&&!home.disabled){e.preventDefault();home.click();}});
function animate(time:number):void {if(playing&&frames.length){if(last){fraction+=(time-last)*.06*Number(byId<HTMLSelectElement>('speed').value);const ticks=Math.floor(fraction);fraction-=ticks;slider.value=String(Math.min(frames.length-1,Number(slider.value)+ticks));draw();if(Number(slider.value)===frames.length-1)stop();}last=time;}requestAnimationFrame(animate);}draw();requestAnimationFrame(animate);
