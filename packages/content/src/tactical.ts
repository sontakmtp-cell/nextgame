import type { BotDefinition, Expr, InlineRule, ModuleIntent, Placement } from '@prompt-chien/contracts';

const c=(value:number):Expr=>({kind:'const',value});
const s=(name:string):Expr=>({kind:'sensor',name});
const v=(id:string):Expr=>({kind:'var',id});
const op=(op:'add'|'sub'|'mul'|'div'|'min'|'max',left:Expr,right:Expr):Expr=>({kind:'op',op,left,right});
const cmp=(left:Expr,op:'eq'|'lt'|'lte'|'gt'|'gte',right:number|Expr):Expr=>({kind:'compare',op,left,right:typeof right==='number'?c(right):right});
const all=(...args:Expr[]):Expr=>({kind:'all',args});
const any=(...args:Expr[]):Expr=>({kind:'any',args});
const abs=(value:Expr)=>op('max',value,op('mul',value,c(-1)));
const clamp=(value:Expr,min:number,max:number):Expr=>({kind:'clamp',value,min:c(min),max:c(max)});
const face=(name:string)=>clamp(op('mul',s(name),c(4)),-1000,1000);
const distance=s('enemy.distance'),bearing=s('enemy.bearing');
const incoming=all(cmp(s('projectile.present'),'eq',1),cmp(s('projectile.distance'),'lt',5000),cmp(s('projectile.closingSpeed'),'gt',1500));

const profiles=[
  {name:'Nightfang · Sát thủ',kind:'assassin',weapon:'blade',extra:'blade',range:4200},
  {name:'Longshot · Xạ thủ cấu rỉa',kind:'marksman',weapon:'burst',extra:null,range:8500},
  {name:'Sidewinder · Xạ thủ cơ động',kind:'skirmisher',weapon:'burst',extra:'blade',range:6500},
  {name:'Ironclad · Đấu sĩ',kind:'bruiser',weapon:'blade',extra:'shield',range:4200}
] as const;

/** Playable samples use only the current catalog and public observations. */
export const tacticalKits:readonly BotDefinition[]=profiles.map(profile=>{
  const module=(id:string,catalogId:string,x:number,y:number):Placement=>({id,catalogId,cell:{x,y},orientation:0});
  const modules=[module('coreMain','core',5,5),
    module('driveTop','thruster',4,5),module('driveBottom','thruster',4,6),
    module('driveUpper','thruster',4,4),module('driveLower','thruster',4,7),
    module('coolTop','radiator',5,4),module('coolFront','radiator',6,4),
    module('reserve','capacitor',5,7),module('coreGuard','armor',6,7),
    module('primary',profile.weapon,7,5),
    ...(profile.extra?[module('secondary',profile.extra,7,6)]:[])
  ];
  const weapons=modules.filter(m=>m.catalogId==='blade'||m.catalogId==='burst');
  const shield=modules.find(m=>m.catalogId==='shield');
  const shieldOff:ModuleIntent[]=shield?[{moduleId:shield.id,action:'shieldOff',priority:0}]:[];
  const rules:({id:string}&InlineRule)[]=[];
  const add=(id:string,when:Expr,forward:number|Expr,strafe:number|Expr,turn:Expr=face('enemy.bearing'),events:ModuleIntent[]=shieldOff,cooling=false)=>{
    rules.push({id,when,intent:{thrust:{forward:typeof forward==='number'?c(forward):forward,strafe:typeof strafe==='number'?c(strafe):strafe},turn,modules:events},set:[{variable:'cooling',value:{kind:'bool',value:cooling}},...(events.some(e=>e.action==='shieldOn')?[{variable:'guardUntil',value:op('add',s('clock.tick'),c(36))}]:[])]});
  };
  const centerForward=clamp(op('sub',s('arena.centerDistance'),c(1800)),0,1000);
  add('returnToSafety',any(cmp(s('self.outsideRing'),'eq',1),cmp(s('arena.centerDistance'),'gt',op('sub',s('arena.ringRadius'),c(2500)))),1000,0,face('arena.centerBearing'));
  add('coolDown',any(cmp(s('self.overheated'),'eq',1),cmp(s('self.heat'),'gte',780),all(v('cooling'),cmp(s('self.heat'),'gt',420))),centerForward,0,face('arena.centerBearing'),shieldOff,true);
  add('weaponsLost',all(...weapons.map(m=>cmp(s(`self.moduleAlive.${m.id}`),'eq',0))),centerForward,0,face('arena.centerBearing'));
  if(shield){
    const block=all(cmp(s(`self.moduleAlive.${shield.id}`),'eq',1),cmp(s('self.energy'),'gte',220),cmp(abs(bearing),'lt',480),any(incoming,all(cmp(s('enemy.telegraph'),'eq',1),cmp(distance,'lt',6500))));
    add('blockAndCounter',all(block,cmp(s('self.weaponReady.primary'),'eq',1),cmp(distance,'lt',5000)),1000,0,face('enemy.bearing'),[{moduleId:shield.id,action:'shieldOn',priority:0},{moduleId:'primary',action:'activate',aimOffset:c(0),priority:1}]);
    add('blockThreat',block,1000,0,face('enemy.bearing'),[{moduleId:shield.id,action:'shieldOn',priority:0}]);
    const guarding=all(cmp(v('guardUntil'),'gt',s('clock.tick')),cmp(s(`self.moduleAlive.${shield.id}`),'eq',1),cmp(s('self.energy'),'gte',140));
    add('guardAndCounter',all(guarding,cmp(s('self.weaponReady.primary'),'eq',1),cmp(abs(bearing),'lt',420),cmp(distance,'lt',5000)),1000,0,face('enemy.bearing'),[{moduleId:'primary',action:'activate',aimOffset:c(0),priority:1}]);
    add('followThroughGuard',guarding,1000,0,face('enemy.bearing'),[]);
  }
  // ponytail: nearest-projectile dodge only; use a versioned multi-projectile sensor if crossfire needs planning.
  add('dodgeLeft',all(incoming,cmp(s('projectile.bearing'),'gte',0)),0,-1000);
  add('dodgeRight',incoming,0,1000);
  if(profile.kind==='assassin'||profile.kind==='skirmisher')add('evadeMelee',all(cmp(s('enemy.telegraph'),'eq',1),cmp(distance,'lt',4500),cmp(s('enemy.coreHpPermille'),'gt',250)),-350,850);
  const ranged=profile.weapon==='burst';
  const moveForward=ranged?clamp(op('sub',distance,c(profile.range)),-850,900):c(850);
  const strafe=ranged?c(profile.kind==='skirmisher'?650:250):c(profile.kind==='assassin'?250:0);
  for(const weapon of weapons){
    const burst=weapon.catalogId==='burst',cost=burst?180:140,heat=burst?220:180;
    const ready=all(cmp(s(`self.weaponReady.${weapon.id}`),'eq',1),cmp(s('self.energy'),'gte',cost),cmp(s('self.heat'),'lte',1000-heat-1),cmp(abs(bearing),'lt',burst?200:420),cmp(distance,'lt',burst?12500:5000));
    const fire:ModuleIntent[]=[...shieldOff,{moduleId:weapon.id,action:'activate',aimOffset:burst?clamp(bearing,-256,256):c(0),priority:1}];
    add(`finishWith_${weapon.id}`,all(ready,cmp(s('enemy.coreHpPermille'),'lte',250)),burst?650:1000,0,face('enemy.bearing'),fire);
    add(`attackWith_${weapon.id}`,ready,burst?moveForward:700,burst?strafe:profile.kind==='assassin'?250:0,face('enemy.bearing'),fire);
  }
  if(ranged){
    add('escapeMelee',cmp(distance,'lt',5000),-900,450);
    add('recoverResources',any(cmp(s('self.energy'),'lt',180),cmp(s('self.coreHpPermille'),'lt',300)),centerForward,0,face('arena.centerBearing'));
    add('takeCenter',all(cmp(s('arena.centerDistance'),'gt',2400),cmp(distance,'gt',profile.range)),1000,0,face('arena.centerBearing'));
    add('holdCenter',all(cmp(s('arena.centerDistance'),'lte',2400),cmp(distance,'gt',profile.range-1000)),0,0);
  }else{
    add('recoverResources',cmp(s('self.energy'),'lt',140),centerForward,0,face('arena.centerBearing'));
    add('takeCenter',cmp(distance,'gt',9000),centerForward,0,face('arena.centerBearing'));
  }
  add('faceTarget',cmp(abs(bearing),'gt',650),0,0);
  add('engage',{kind:'bool',value:true},moveForward,strafe);
  return {schemaVersion:'2.0',name:profile.name,body:{grid:'square-12-v1',modules},
    brain:{abiVersion:'2.0',initialState:'hunt',variables:[{id:'cooling',type:'bool',initial:false},...(shield?[{id:'guardUntil',type:'int' as const,initial:0}]:[])],skills:[],states:[{id:'hunt',rules}]},
    cosmetic:{skinId:'ceramic-default',paletteId:'team-auto'}};
});

export const tacticalCards=[
  {name:profiles[0].name,goal:'Sát thủ hai Blade: áp sát chéo, đánh luân phiên, né đòn báo trước và dồn sát thương kết liễu.',weakness:'Phải vào cận chiến; mất động cơ dễ bị xạ thủ giữ khoảng cách.'},
  {name:profiles[1].name,goal:'Xạ thủ cấu rỉa: giữ tầm 8,5, né đạn đang bay tới, chỉ bắn khi đủ tài nguyên và đúng góc.',weakness:'Đạn cần thời gian bay; đối thủ áp sát hoặc giữ trung tâm có thể gây sức ép.'},
  {name:profiles[2].name,goal:'Xạ thủ cơ động: vừa bắn vừa di chuyển ngang ở tầm 6,5, dùng Blade khi đối thủ áp sát.',weakness:'Hai loại vũ khí dùng chung năng lượng; không thể bắn và chém liên tục.'},
  {name:profiles[3].name,goal:'Đấu sĩ: bật khiên theo dấu hiệu tấn công, phản công Blade, quản lý nhiệt và tranh trung tâm.',weakness:'Khiên chỉ che phía trước và có thời gian khóa sau khi tắt; dễ bị đánh vòng.'}
] as const;
