/** Public pose replay DTOs. Private VM/resources are deliberately absent. */
export interface Pose { x:number; y:number; heading:number }
export interface PublicModule { ordinal:number; catalogId:string; x:number; y:number; orientation:number; hp:number; status:'alive'|'destroyed'|'detached'; phase:'idle'|'windup'|'active'|'recovery'; phaseOffset:number; shield:boolean; aim:number }
export interface PublicActor { pose:Pose; modules:PublicModule[]; overheated:boolean; controlTicks:number }
export interface PublicProjectile { ordinal:number; owner:'A'|'B'; x:number; y:number; heading:number }
export interface CombatEvent { tick:number; kind:'activation'|'intentRejected'|'shot'|'hit'|'blocked'|'destroyed'|'detached'|'shieldOn'|'shieldOff'|'overheated'|'cooled'|'collisionFallback'|'ringNotice'|'ringDamage'|'result'; actor:'A'|'B'|'world'; module:number; target:number; value:number; key:number }
export interface PublicFrame { boundary:number; actors:{A:PublicActor;B:PublicActor}; projectiles:PublicProjectile[]; controlOwner:'A'|'B'|'neutral'; ringRadius:number; events:CombatEvent[] }
