import type { BotDefinition, BrainSource, Expr, InlineRule, Placement } from '@prompt-chien/contracts';
const c=(value:number):Expr=>({kind:'const',value});
const sensor=(name:string):Expr=>({kind:'sensor',name});
const compare=(name:string,op:'lt'|'gt'|'eq',value:number):Expr=>({kind:'compare',op,left:sensor(name),right:c(value)});
const face=(name:string):Expr=>({kind:'clamp',value:{kind:'op',op:'mul',left:sensor(name),right:c(4)},min:c(-1000),max:c(1000)});
const rule=(id:string,when:Expr,forward:number,strafe:number,turn:Expr,modules:InlineRule['intent']['modules']=[]):{id:string}&InlineRule=>({id,when,intent:{thrust:{forward:c(forward),strafe:c(strafe)},turn,modules}});
function brain(modules:Placement[],name:string,adaptive:boolean):BrainSource {
  const weapon=modules.find(m=>m.catalogId==='blade'||m.catalogId==='burst')!,shield=modules.find(m=>m.catalogId==='shield');
  const fire:InlineRule['intent']['modules']=[{moduleId:weapon.id,action:'activate',aimOffset:weapon.catalogId==='burst'?{kind:'clamp',value:sensor('enemy.bearing'),min:c(-256),max:c(256)}:c(0),priority:1}];
  if(!adaptive)return {abiVersion:'2.0',initialState:'hunt',variables:[],skills:[],states:[{id:'hunt',rules:[rule('fixedDrive',{kind:'bool',value:true},1000,0,c(0),fire)]}]};
  const events:InlineRule['intent']['modules']=shield?[{moduleId:shield.id,action:'shieldOn',priority:0},...fire]:fire;
  const rules:({id:string}&InlineRule)[]=[
    rule('returnToRing',compare('self.outsideRing','eq',1),1000,0,face('arena.centerBearing')),
    rule('coolAndControl',compare('self.overheated','eq',1),700,0,face('arena.centerBearing'),shield?[{moduleId:shield.id,action:'shieldOff',priority:0}]:[]),
  ];
  if(name==='Mantis')rules.push(rule('evadeWindup',{kind:'all',args:[compare('enemy.telegraph','eq',1),compare('enemy.distance','lt',6500)]},0,1000,face('enemy.bearing')));
  if(name==='Kestrel')rules.push(rule('kite',compare('enemy.distance','lt',7000),-700,700,face('enemy.bearing'),events),rule('fireAtRange',compare('enemy.distance','lt',12500),0,500,face('enemy.bearing'),events));
  if(shield)rules.push(rule('blockTelegraph',compare('enemy.telegraph','eq',1),500,0,face('enemy.bearing'),events));
  rules.push(rule('engage',compare('enemy.distance','lt',weapon.catalogId==='blade'?5000:14000),name==='Bastion-lite'?300:800,name==='Mantis'?300:0,face('enemy.bearing'),events),rule('takeCenter',{kind:'bool',value:true},1000,0,face('arena.centerBearing')));
  return {abiVersion:'2.0',initialState:'hunt',variables:[],skills:[],states:[{id:'hunt',rules}]};
}
export function buildSlice(referenceKits:readonly BotDefinition[]):readonly BotDefinition[] {return ([referenceKits[0]!,{
  ...referenceKits[0]!,name:'Bastion-lite',body:{grid:'square-12-v1',modules:[...referenceKits[0]!.body.modules.filter(m=>m.catalogId!=='radiator'),{id:'guard',catalogId:'shield',cell:{x:7,y:6},orientation:0}]}
},referenceKits[2]!] satisfies BotDefinition[]).map(bot=>({...bot,brain:brain(bot.body.modules,bot.name,true)}));}
export function passiveVariant(bot:BotDefinition):BotDefinition {return {...bot,name:`${bot.name} passive`,brain:brain(bot.body.modules,bot.name,false)};}
export const behaviorCards= [
  {name:'Mantis',goal:'Áp sát, né windup rồi đánh Blade.',weakness:'Burst kiểm soát đường áp sát; orbit dễ nhường vùng trung tâm.'},
  {name:'Bastion-lite',goal:'Giữ hướng về đối thủ, bật Shield khi thấy windup và dùng Blade cận chiến.',weakness:'Energy dùng chung khiên/vũ khí; flank ngoài cung 90°.'},
  {name:'Kestrel',goal:'Giữ khoảng cách Burst, đổi lane và trở về ring khi bị ép.',weakness:'Kiting nhường control; góc aim giới hạn và có thể tự che muzzle.'}
] as const;
