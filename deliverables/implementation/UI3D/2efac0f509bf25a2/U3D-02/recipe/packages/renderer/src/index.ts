import { Application, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { PublicFrame, PublicModule } from '@prompt-chien/contracts';
export type Quality='high'|'medium'|'low';
const color={A:0xf27b59,B:0x65c8d4},unit=25;
import { eventLocation } from '@prompt-chien/presentation';
export { ArenaAudio, eventLocation } from '@prompt-chien/presentation';
export interface ArenaOptions {quality:Quality;vfx:boolean;reducedMotion:boolean;grayscale:boolean}
export class ArenaRenderer {
  readonly app=new Application();readonly world=new Container();readonly ground=new Container();readonly bodies=new Container();readonly fx=new Graphics();readonly shapes=new Graphics();
  readonly actors={A:new Container(),B:new Container()};readonly sprites=new Map<string,Sprite>();readonly textures=new Map<string,Texture>();
  readonly samples:number[]=[];private observer:ResizeObserver|undefined;private lastTick=-1;private lost=false;private background:Texture|undefined;
  options:ArenaOptions={quality:'high',vfx:true,reducedMotion:false,grayscale:false};
  constructor(private host:HTMLElement,private onContext:(lost:boolean)=>void){}
  async init():Promise<void>{
    await this.app.init({width:1000,height:700,background:0x090d11,preference:'webgl',preferWebGLVersion:2,resolution:Math.min(devicePixelRatio,2),autoDensity:true,autoStart:false,antialias:true});
    const image=await loadImage('/assets/modules.svg'),atlas=Texture.from(image);this.background=Texture.from(await loadImage('/assets/arena.svg'));
    const ids=['core','thruster','armor','blade','burst','shield','radiator','capacitor','lance','breaker'];ids.forEach((id,i)=>this.textures.set(id,new Texture({source:atlas.source,frame:new Rectangle((i%5)*128,Math.floor(i/5)*128,128,128)})));
    const floor=new Sprite(this.background);this.ground.addChild(floor);this.world.addChild(this.ground,this.bodies,this.shapes,this.fx);this.bodies.addChild(this.actors.A,this.actors.B);this.app.stage.addChild(this.world);
    this.host.append(this.app.canvas);this.app.canvas.setAttribute('aria-label','Arena: hai Synth tự chiến đấu; trạng thái và sự kiện nằm dưới sân.');this.app.canvas.setAttribute('role','img');
    this.app.canvas.addEventListener('webglcontextlost',this.contextLost);this.app.canvas.addEventListener('webglcontextrestored',this.contextRestored);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.host);this.resize();
  }
  private contextLost=(event:Event)=>{event.preventDefault();this.lost=true;this.onContext(true);};
  private contextRestored=()=>{this.lost=false;this.lastTick=-1;this.onContext(false);};
  private resize():void{const width=Math.max(1,this.host.clientWidth),height=width*.7;this.app.renderer.resize(width,height);this.world.scale.set(width/1000);if(!this.lost)this.app.render();}
  render(frames:readonly PublicFrame[],tick:number,options:ArenaOptions):void{
    if(this.lost||!frames.length)return;const start=performance.now(),index=Math.min(frames.length-1,Math.floor(tick)),frame=frames[index]!;
    if(this.lastTick===tick&&JSON.stringify(options)===JSON.stringify(this.options))return;this.lastTick=tick;this.options=options;
    const resolution=Math.min(devicePixelRatio,options.quality==='low'?1.5:2);if(this.app.renderer.resolution!==resolution){this.app.renderer.resolution=resolution;this.resize();}this.host.style.filter=options.grayscale?'grayscale(1)':'';
    this.shapes.clear();this.fx.clear();this.shapes.circle(500,350,75).stroke({color:0xf1c86b,width:2});
    if(frame.controlOwner!=='neutral')this.shapes.circle(500,350,73).fill({color:color[frame.controlOwner],alpha:.08});
    if(frame.ringRadius<25000)this.shapes.circle(500,350,frame.ringRadius/1000*unit).stroke({color:0xec6a68,width:2});
    const aliveKeys=new Set<string>();
    for(const id of ['A','B'] as const){const a=frame.actors[id],next=frames[Math.min(index+1,frames.length-1)]!.actors[id],fraction=tick-index,core=a.modules.find(m=>m.catalogId==='core')!,bot=this.actors[id];
      bot.position.set(500+(a.pose.x+(next.pose.x-a.pose.x)*fraction)/1000*unit,350-(a.pose.y+(next.pose.y-a.pose.y)*fraction)/1000*unit);
      const dh=((next.pose.heading-a.pose.heading+6144)%4096)-2048;bot.rotation=-(a.pose.heading+dh*fraction)*Math.PI/2048;
      for(const m of a.modules){if(m.status!=='alive')continue;const key=`${id}/${m.ordinal}`,size=m.catalogId==='core'?2:1;aliveKeys.add(key);let sprite=this.sprites.get(key);
        if(!sprite){sprite=new Sprite(this.textures.get(m.catalogId)!);sprite.anchor.set(.5);bot.addChild(sprite);this.sprites.set(key,sprite);}
        sprite.visible=true;sprite.position.set((m.x-core.x-1+size/2)*unit,-(m.y-core.y-1+size/2)*unit);sprite.width=sprite.height=size*unit;sprite.rotation=-m.orientation*Math.PI/2;
        const damaged=m.hp<(m.catalogId==='core'?400:100);sprite.tint=damaged?0xb7a896:0xffffff;
        const local={x:(m.x-core.x-1+size/2)*unit,y:-(m.y-core.y-1+size/2)*unit};
        const point=this.point(bot,local.x,local.y);this.shapes.circle(point.x,point.y,size===2?6:2).fill(color[id]);
        if(id==='B'){this.shapes.moveTo(point.x-5,point.y+8).lineTo(point.x-1,point.y+8).moveTo(point.x+2,point.y+8).lineTo(point.x+6,point.y+8).stroke({color:color.B,width:2});}
        else this.shapes.moveTo(point.x-5,point.y+8).lineTo(point.x+5,point.y+8).stroke({color:color.A,width:2});
        if(damaged)this.shapes.moveTo(point.x-6,point.y-5).lineTo(point.x,point.y).lineTo(point.x-3,point.y+7).stroke({color:0x39434c,width:1.5});
        if(m.phase==='windup'||m.phase==='active')this.telegraph(bot,m,core,options);
        if(m.shield){const radius=Math.max(...a.modules.flatMap(n=>{const s=n.catalogId==='core'?2:1;return [0,s].flatMap(x=>[0,s].map(y=>Math.hypot(n.x-core.x-1+x,n.y-core.y-1+y)));}))+.25;
          const heading=bot.rotation-m.orientation*Math.PI/2,r=(Math.ceil((radius-.25)*1000)/1000+.25)*unit;this.shapes.moveTo(bot.x+Math.cos(heading-Math.PI/4)*r,bot.y+Math.sin(heading-Math.PI/4)*r).arc(bot.x,bot.y,r,heading-Math.PI/4,heading+Math.PI/4).stroke({color:color[id],width:3});}
      }
      const hp=core.hp/800;this.shapes.rect(bot.x-23,bot.y+42,46,4).fill(0x39434c).rect(bot.x-23,bot.y+42,46*hp,4).fill(color[id]);
      if(id==='A')this.shapes.circle(bot.x,bot.y-44,5).stroke({color:color.A,width:2});else this.shapes.poly([bot.x-6,bot.y-44,bot.x-3,bot.y-49,bot.x+3,bot.y-49,bot.x+6,bot.y-44,bot.x+3,bot.y-39,bot.x-3,bot.y-39]).stroke({color:color.B,width:2});
    }
    for(const [key,sprite] of this.sprites)if(!aliveKeys.has(key))sprite.visible=false;
    for(const p of frame.projectiles){const x=500+p.x/1000*unit,y=350-p.y/1000*unit;this.shapes.circle(x,y,2.5).fill(0xf1eadc);if(options.quality!=='low'&&options.vfx&&!options.reducedMotion){const h=-p.heading*Math.PI/2048;this.fx.moveTo(x,y).lineTo(x-Math.cos(h)*8,y-Math.sin(h)*8).stroke({color:color[p.owner],width:2});}}
    if(options.vfx&&!options.reducedMotion){const windowTicks=options.quality==='high'?24:options.quality==='medium'?10:4;
      // ponytail: cap cosmetic flashes at 64/24/8; keep every authority event and telegraph. Batch sprites if denser FX are required.
      const cap=options.quality==='high'?64:options.quality==='medium'?24:8;let count=0;
      effects:for(let n=index;n>=Math.max(0,index-windowTicks);n--)for(const e of frames[n]!.events){if(!['hit','destroyed','blocked'].includes(e.kind))continue;const location=eventLocation(e);if(location.actor==='world')continue;const actor=frames[n]!.actors[location.actor],module=actor.modules[location.module]??actor.modules[0]!,core=actor.modules.find(m=>m.catalogId==='core')!,pose={x:500+actor.pose.x/1000*unit,y:350-actor.pose.y/1000*unit,rotation:-actor.pose.heading*Math.PI/2048},size=module.catalogId==='core'?2:1,pt=this.point(pose,(module.x-core.x-1+size/2)*unit,-(module.y-core.y-1+size/2)*unit),age=index-n;
        this.fx.circle(pt.x,pt.y,4+age*.8).stroke({color:e.kind==='blocked'?0x65c8d4:0xf1eadc,width:2,alpha:Math.max(0,1-age/windowTicks)});
        if(++count===cap)break effects;
      }
    }
    this.app.render();if(this.samples.length<20000)this.samples.push(performance.now()-start);
  }
  private point(bot:Pick<Container,'x'|'y'|'rotation'>,x:number,y:number):{x:number;y:number}{const c=Math.cos(bot.rotation),s=Math.sin(bot.rotation);return {x:bot.x+x*c-y*s,y:bot.y+x*s+y*c};}
  private telegraph(bot:Container,m:PublicModule,core:PublicModule,options:ArenaOptions):void{
    const heading=bot.rotation-(m.orientation*1024+m.aim)*Math.PI/2048,center=this.point(bot,(m.x-core.x-.5)*unit,-(m.y-core.y-.5)*unit),x=center.x+Math.cos(heading)*.501*unit,y=center.y+Math.sin(heading)*.501*unit;
    const active=m.phase==='active',color=active?0xf1eadc:0xf1c86b;
    if(m.catalogId==='blade'){this.shapes.moveTo(x,y).arc(x,y,1.5*unit,heading-Math.PI/4,heading+Math.PI/4).lineTo(x,y).stroke({color,width:2});if(active&&options.vfx)this.shapes.fill({color,alpha:.18});}
    if(m.catalogId==='burst')this.shapes.moveTo(x,y).lineTo(x+Math.cos(heading)*300,y+Math.sin(heading)*300).stroke({color,width:active?2:1.5,alpha:.65});
  }
  destroy():void{this.observer?.disconnect();this.app.canvas.removeEventListener('webglcontextlost',this.contextLost);this.app.canvas.removeEventListener('webglcontextrestored',this.contextRestored);this.app.destroy(true,{children:true,texture:true,textureSource:true});}
}
function loadImage(url:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`Không tải được asset ${url}`));image.src=url;});}
