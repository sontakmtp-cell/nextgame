import type { CompiledBrain, ControlIntent, MatchManifest, MatchResult, Placement, Pose, PublicFrame, CombatEvent } from '@prompt-chien/contracts';
import type { VMState } from '@prompt-chien/brain';
export type ActorId='A'|'B';
export interface ModuleState { placement:Placement; ordinal:number; hp:number; initialHp:number; alive:boolean; detached:boolean; phase:'idle'|'windup'|'active'|'recovery'; offset:number; aim:number; attack:number; hit:boolean; shield:boolean; shieldLock:number }
export interface Actor { id:ActorId; pose:Pose; vx:number; vy:number; omega:number; residual:{x:number;y:number;heading:number;accel:number;angular:number}; mass:number; radius:number; torque0:number; initialTotalHp:number; core:number; modules:ModuleState[]; compiled:CompiledBrain; vm:VMState; energy:number; heat:number; overheated:boolean; damage:number; controlTicks:number; ringRemainder:number; intent:ControlIntent }
export interface Projectile { ordinal:number; owner:ActorId; weapon:number; attack:number; x:number;y:number; heading:number; remaining:number; born:number; residual:{x:number;y:number}; origin:{x:number;y:number} }
export interface DecisionTrace { tick:number;actor:ActorId;stateId:string;ruleId:string|null;gas:number;fault:string|null;observationsUsed:Record<string,number>;varDiff:Record<string,number|boolean>;intent:ControlIntent;rejections:string[] }
export interface World { manifest:MatchManifest; tick:number; actors:{A:Actor;B:Actor}; projectiles:Projectile[]; nextProjectile:number; nextAttack:number; events:CombatEvent[]; traces:DecisionTrace[]; controlOwner:ActorId|'neutral'; ringRadius:number; result:MatchResult|null }
export interface HitPacket { key:number;source:ActorId;target:ActorId;module:number;raw:number;origin:{x:number;y:number};attack:number }
export interface RecordedMatch { manifest:MatchManifest; frames:PublicFrame[]; checkpoints:Checkpoint[]; traces:DecisionTrace[]; result:MatchResult; simulationHash:string; privateTraceHash:string }
export interface CheckpointActor extends Omit<Actor,'vm'> {vm:Omit<VMState,'variables'> & {variables:[string,number|boolean][]}}
export interface Checkpoint extends Omit<World,'actors'|'events'|'traces'> {actors:{A:CheckpointActor;B:CheckpointActor};events:CombatEvent[];traces:DecisionTrace[]}
