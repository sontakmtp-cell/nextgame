import type { BotDefinition, Expr, InlineRule, ModuleIntent } from '@prompt-chien/contracts';
import { clone } from './model.js';

const c=(value:number):Expr=>({kind:'const',value});
const s=(name:string):Expr=>({kind:'sensor',name});
const compare=(name:string,op:'lt'|'gt'|'eq',value:number):Expr=>({kind:'compare',op,left:s(name),right:c(value)});
const all=(...args:Expr[]):Expr=>({kind:'all',args});
const face:Expr={kind:'clamp',value:{kind:'op',op:'mul',left:s('enemy.bearing'),right:c(4)},min:c(-1000),max:c(1000)};
const center:Expr={...face, value:{kind:'op',op:'mul',left:s('arena.centerBearing'),right:c(4)}};
const intent=(forward=0,strafe=0,turn:Expr=face,modules:ModuleIntent[]=[]):InlineRule['intent']=>({thrust:{forward:c(forward),strafe:c(strafe)},turn,modules});

export const nodeLibrary=[
  {id:'approach',name:'Áp sát đối thủ',group:'Di chuyển',description:'Tiến lên và xoay về đối thủ khi còn ở xa.',example:'Khoảng cách > 5 → tiến tới.'},
  {id:'keepRange',name:'Giữ khoảng cách',group:'Di chuyển',description:'Lùi và lách ngang khi đối thủ áp sát.',example:'Khoảng cách < 7 → lùi chéo.'},
  {id:'orbit',name:'Đi vòng đối thủ',group:'Di chuyển',description:'Di chuyển ngang trong khi giữ mặt hướng về mục tiêu.',example:'Đối thủ ở gần → đi vòng sang phải.'},
  {id:'burst',name:'Bắn cấu rỉa',group:'Tấn công',module:'burst',description:'Bắn khi súng sẵn sàng và đủ năng lượng; chỉnh góc ngắm theo đối thủ.',example:'Trong tầm 12,5 + đủ 180 năng lượng → bắn.'},
  {id:'blade',name:'Chém cận chiến',group:'Tấn công',module:'blade',description:'Tiến vào tầm đánh rồi kích hoạt kiếm.',example:'Khoảng cách < 5 + kiếm sẵn sàng → chém.'},
  {id:'shield',name:'Đỡ đòn bằng khiên',group:'Phòng thủ',module:'shield',description:'Bật khiên và hướng về đối thủ lúc thấy họ chuẩn bị đánh.',example:'Đối thủ báo đòn + đủ năng lượng → che chắn.'},
  {id:'shieldOff',name:'Tắt khiên tiết kiệm',group:'Phòng thủ',module:'shield',description:'Tắt khiên khi đối thủ hết báo đòn để dành năng lượng.',example:'Không có báo đòn → tắt khiên.'},
  {id:'dodge',name:'Né đạn đang tới',group:'Phòng thủ',description:'Chỉ né khi có đạn gần đang tiến về bot.',example:'Đạn cách < 5 và đang bay tới → lách ngang.'},
  {id:'ring',name:'Trở về vùng an toàn',group:'Phòng thủ',description:'Xoay và chạy về trung tâm khi ra ngoài vòng đấu.',example:'Ngoài vòng → quay về trung tâm.'},
  {id:'cool',name:'Hạ nhiệt',group:'Phòng thủ',description:'Ngừng dùng vũ khí và trở về trung tâm khi nhiệt cao.',example:'Nhiệt > 750 → nghỉ bắn.'},
  {id:'lowHp',name:'Đọc lượng máu',group:'Điều kiện',description:'Dùng cảm biến máu của chính bot để quyết định rút lui.',example:'Máu lõi < 30% → lùi.'},
  {id:'and',name:'Tất cả điều kiện · AND',group:'Điều kiện',description:'Hành động chỉ khi mọi điều kiện đều đúng.',example:'Đối thủ gần VÀ bot đủ năng lượng → áp sát.'},
  {id:'or',name:'Một điều kiện · OR',group:'Điều kiện',description:'Chỉ cần một điều kiện đúng để chọn hành động.',example:'Nhiệt cao HOẶC năng lượng thấp → nghỉ.'},
  {id:'memory',name:'Ghi nhớ quyết định',group:'Bộ nhớ & trạng thái',description:'Tạo biến đếm và tăng nó mỗi lần quy tắc được chọn.',example:'Đối thủ gần → tăng bộ đếm thêm 1.'},
  {id:'transition',name:'Chuyển trạng thái',group:'Bộ nhớ & trạng thái',description:'Tạo trạng thái nghỉ, chuyển sang đó khi nhiệt cao; nguội rồi quay lại.',example:'Nhiệt > 750 → nghỉ; nhiệt < 420 → quay lại.'},
  {id:'wait',name:'Chờ / dự phòng',group:'Bộ nhớ & trạng thái',description:'Dừng di chuyển nếu không có quy tắc nào trước đó phù hợp.',example:'Các điều kiện trước đều sai → chờ.'}
] as const;
export type LibraryNode=typeof nodeLibrary[number];

export function nodeUnavailable(bot:BotDefinition,stateIndex:number,node:LibraryNode):string|null {
  const state=bot.brain.states[stateIndex];
  if(!state)return 'Chọn một trạng thái trước.';
  if(state.rules.length>=32)return 'Trạng thái này đã đủ 32 luật.';
  if('module' in node&&!bot.body.modules.some(m=>m.catalogId===node.module))return `Cần lắp ${node.module==='burst'?'súng Burst':node.module==='blade'?'kiếm Blade':'khiên'} trong Workshop.`;
  if(node.id==='memory'&&bot.brain.variables.length>=64)return 'Bot đã đủ 64 biến nhớ.';
  if(node.id==='transition'&&bot.brain.states.length>=32)return 'Bot đã đủ 32 trạng thái.';
  return null;
}

export function insertLibraryNode(bot:BotDefinition,stateIndex:number,node:LibraryNode):{bot:BotDefinition;ruleIndex:number} {
  const reason=nodeUnavailable(bot,stateIndex,node);if(reason)throw new Error(reason);
  const next=clone(bot),state=next.brain.states[stateIndex]!;
  const unique=(base:string,rows:{id:string}[])=>{let id=base,n=2;while(rows.some(row=>row.id===id))id=`${base}${n++}`;return id;};
  const rule:{id:string}&InlineRule={id:unique(node.id,state.rules),when:{kind:'bool',value:true},intent:intent()};
  switch(node.id){
    case 'approach':rule.when=compare('enemy.distance','gt',5000);rule.intent=intent(900);break;
    case 'keepRange':rule.when=compare('enemy.distance','lt',7000);rule.intent=intent(-700,500);break;
    case 'orbit':rule.when=compare('enemy.distance','lt',9000);rule.intent=intent(0,700);break;
    case 'burst':case 'blade':{
      const weapon=next.body.modules.find(m=>m.catalogId===node.id)!,burst=node.id==='burst';
      rule.when=all(compare(`self.weaponReady.${weapon.id}`,'eq',1),compare('self.energy','gt',burst?179:139),compare('self.heat','lt',burst?780:820),compare('enemy.bearing','gt',burst?-200:-420),compare('enemy.bearing','lt',burst?200:420),compare('enemy.distance','lt',burst?12500:5000));
      rule.intent=intent(burst?0:700,burst?350:0,face,[{moduleId:weapon.id,action:'activate',aimOffset:burst?{kind:'clamp',value:s('enemy.bearing'),min:c(-256),max:c(256)}:c(0),priority:1}]);break;
    }
    case 'shield':case 'shieldOff':{
      const shield=next.body.modules.find(m=>m.catalogId==='shield')!;
      rule.when=node.id==='shield'?all(compare('enemy.telegraph','eq',1),compare(`self.moduleAlive.${shield.id}`,'eq',1),compare('self.energy','gt',40),compare('self.overheated','eq',0)):compare('enemy.telegraph','eq',0);
      rule.intent=intent(0,0,face,[{moduleId:shield.id,action:node.id==='shield'?'shieldOn':'shieldOff',priority:0}]);break;
    }
    case 'dodge':rule.when=all(compare('projectile.present','eq',1),compare('projectile.distance','lt',5000),compare('projectile.closingSpeed','gt',1500));rule.intent=intent(0,1000);break;
    case 'ring':rule.when=compare('self.outsideRing','eq',1);rule.intent=intent(1000,0,center);break;
    case 'cool':rule.when=compare('self.heat','gt',750);rule.intent=intent(500,0,center);break;
    case 'lowHp':rule.when=compare('self.coreHpPermille','lt',300);rule.intent=intent(-700,400);break;
    case 'and':rule.when=all(compare('enemy.distance','lt',6000),compare('self.energy','gt',300));rule.intent=intent(700,250);break;
    case 'or':rule.when={kind:'any',args:[compare('self.heat','gt',750),compare('self.energy','lt',180)]};rule.intent=intent(0,0,c(0));break;
    case 'memory':{
      const id=unique('decisionsNear',next.brain.variables);next.brain.variables.push({id,type:'int',initial:0});
      rule.when=compare('enemy.distance','lt',6000);rule.set=[{variable:id,value:{kind:'op',op:'add',left:{kind:'var',id},right:c(1)}}];rule.intent=intent(600,250);break;
    }
    case 'transition':{
      const id=unique('recover',next.brain.states);rule.when=compare('self.heat','gt',750);rule.nextState=id;rule.intent=intent(0,0,c(0));
      next.brain.states.push({id,rules:[{id:'cooled',when:compare('self.heat','lt',420),intent:intent(0,0,c(0)),nextState:state.id},{id:'rest',when:{kind:'bool',value:true},intent:intent(0,0,c(0))}]});break;
    }
    case 'wait':rule.intent=intent(0,0,c(0));break;
  }
  // Preserve existing safety priorities; insert before the first unconditional fallback.
  const fallback=state.rules.findIndex(r=>'when' in r&&r.when.kind==='bool'&&r.when.value);
  const ruleIndex=fallback<0?state.rules.length:fallback;
  state.rules.splice(ruleIndex,0,rule);
  return {bot:next,ruleIndex};
}

export function conditionSummary(expr:Expr):string {
  switch(expr.kind){
    case 'bool':return expr.value?'Luôn đúng (dự phòng)':'Luôn sai (đã khóa)';
    case 'all':return `AND · tất cả ${expr.args.length} điều kiện`;
    case 'any':return `OR · một trong ${expr.args.length} điều kiện`;
    case 'not':return `NOT · đảo điều kiện: ${conditionSummary(expr.value)}`;
    case 'compare':return `${expr.left.kind==='sensor'?expr.left.name:'Biểu thức'} ${{eq:'=',ne:'≠',lt:'<',lte:'≤',gt:'>',gte:'≥'}[expr.op]} ${expr.right.kind==='const'?expr.right.value:'biểu thức'}`;
    case 'var':return `Bộ nhớ · ${expr.id}`;
    default:return 'Biểu thức tính toán';
  }
}
