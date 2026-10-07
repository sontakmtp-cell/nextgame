import type { CombatEvent, PublicFrame } from '@prompt-chien/contracts';
export function eventLocation(event:CombatEvent):{actor:'A'|'B'|'world';module:number}{return {actor:event.kind==='hit'?(event.actor==='A'?'B':'A'):event.actor,module:event.kind==='hit'?event.target:event.module};}
export class ArenaAudio {
  private context:AudioContext|undefined;private master:GainNode|undefined;private buffers=new Map<string,AudioBuffer>();private voices:{source:AudioBufferSourceNode;kind:string}[]=[];private latest=-1;
  async unlock():Promise<void>{this.context??=new AudioContext();if(!this.master){this.master=this.context.createGain();this.master.gain.value=.18;const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-12;this.master.connect(limiter).connect(this.context.destination);}await this.context.resume();
    if(!this.buffers.size)await Promise.all(['activation','shot','hit','blocked','destroyed','shieldOn','shieldOff','overheated','ringNotice','result'].map(async kind=>{const response=await fetch(`/assets/${kind}.wav`);if(!response.ok)throw new Error('AUDIO_ASSET');this.buffers.set(kind,await this.context!.decodeAudioData(await response.arrayBuffer()));}));
  }
  volume(value:number):void{if(this.master)this.master.gain.value=Math.max(0,Math.min(.3,value*.3));}
  stop(tick=-1):void{for(const {source} of this.voices)source.stop();this.voices=[];this.latest=tick;}
  play(frames:readonly PublicFrame[],tick:number,speed:number):void{const current=Math.floor(tick);if(!this.context||!this.master)return;if(speed>1||current<this.latest){this.stop(current);return;}
    if(this.latest>=0)for(let n=this.latest+1;n<=Math.min(current,frames.length-1);n++)for(const event of frames[n]!.events)this.event(event,frames[n]!);this.latest=current;
  }
  private event(event:CombatEvent,frame:PublicFrame):void{const buffer=this.buffers.get(event.kind);if(!buffer||this.voices.length>=15||this.voices.filter(v=>v.kind===event.kind).length>=2)return;const source=this.context!.createBufferSource();source.buffer=buffer;const pan=this.context!.createStereoPanner(),location=eventLocation(event);pan.pan.value=location.actor==='world'?0:Math.max(-1,Math.min(1,frame.actors[location.actor].pose.x/20000));source.connect(pan).connect(this.master!);const voice={source,kind:event.kind};this.voices.push(voice);source.onended=()=>{this.voices=this.voices.filter(v=>v!==voice);pan.disconnect();source.disconnect();};source.start();}
  close():void{this.stop();void this.context?.close();}
}
