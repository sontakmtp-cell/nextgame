# 03 — Bot Package, Brain DSL và extension ABI

**Contract baseline2.0.** Đặc tả phải được Agent T02 chuyển thành JSON Schema2020-12, TypeScript types, validator và fixtures trước code engine. JSON dưới đây là mẫu thiết kế, chưa được runtime validator kiểm tra. Luật ở [02](02_GAMEPLAY.md); MCP không có định nghĩa bot thứ hai.

## 1. Ranh giới sáng tạo

Người chơi/AI tự xây cơ thể, lập trình hành vi, bộ nhớ, phối hợp vũ khí, spatial tactics và skill templates. **Mechanics** (vũ khí/sensor/status mới) đi qua catalog extension được review: cho thử Laboratory → determinism/security/balance gate → publish catalog mùa mới. Không cho code tùy ý của player sửa damage, sensor visibility hay server trong ranked.

Đây là lựa chọn DSL có thể mở rộng thay vì Brain v1 chỉ move/turn hoặc arbitrary JavaScript sandbox. Không hứa người chơi tự tạo một loại vũ khí mới rồi ngay lập tức dùng ranked. Nếu DSL thiếu một ý tưởng hợp lệ, ghi capability request và fixture; thêm operator versioned thay vì escape hatch `eval`.

## 2. Các artifact và vòng đời

| Artifact | Immutable? | Nội dung |
|---|---|---|
| `BotDraft` | Không | ownerId, botId, revision, definition, visibility, lineage |
| `BotDefinition` | Khi publish | schemaVersion, Body, Brain source, cosmetic reference |
| `CompiledBrain` | Có | brainAbiVersion, compilerDigest, normalizedIR, symbolMap |
| `BotPackage` | Có | canonicalGameplay, packageHash, compiler/capability digests |
| `ValidationReport` | Có | packageHash, engineDigest, rulesetDigest, suiteDigest, diagnostics |
| `BehaviorCard` | Có theo version | Hypothesis, tactics, known weaknesses; không sim authority |
| `Experiment` | Có sau completed | input hashes, seedSetDigest, paired results, confidence, cost |

Draft revision CAS: gửi `expectedRevision`; conflict409 không auto overwrite. Freeze diễn ra sau compile+validation trên đúng revision; thay đổi draft không mutate package. Publish tạo lineage edge `parentPackageHash`; fork đối thủ chỉ khi chủ đã public source và license cho phép. Export source chỉ owner/public license; public replay không đủ quyền lấy Brain.

## 3. BotDefinition logic

```ts
interface BotDefinition {
  schemaVersion: '2.0';
  name: string;                         // UI, không tính gameplay hash
  body: {grid: 'square-12-v1'; modules: ModulePlacement[]};
  brain: BrainSource;
  cosmetic: {skinId: string; paletteId: string};
}
interface ModulePlacement {
  id: string; catalogId: string;
  cell: {x: number; y: number}; orientation: 0|1|2|3;
}
```

`id`/state/variable/skill identifiers ASCII `[A-Za-z][A-Za-z0-9_-]{0,47}`; name UI NFC, 1..64 Unicode scalar, plain text. Không convert identifier thành prototype/object property có quyền; dictionaries dùng Map. Validator reject `__proto__`, `constructor`, `prototype` và unknown fields ở mọi object. JSON integer duy nhất cho gameplay, không NaN/float/coercion. Max uncompressed request256KiB, JSON nesting32, modules24; decoder streaming bound trước parse. Mẫu đủ trường của schema ở [example](examples/mantis.bot.json): fixture cho parser/canonicalization và FSM, **không phải bot đã playtest**. Nó cố ý có module shield chưa điều khiển để test mapping Body; ngưỡng strike dùng khoảng cách Core không bảo đảm hit geometry. T05/T13 phải tạo reference brains có cảm biến/logic range thực và fallback, không dùng fixture này làm bằng chứng counterplay.

Canonical gameplay chứa body normalized + Brain IR + `schemaVersion,brainAbiVersion,compilerDigest,catalogDigest`. Sort modules theo geometry ordinal; rewrite mọi reference. Object keys canonical lexicographic, strings NFC, integers decimal, không whitespace; T02 phải dùng một canonical encoder xác định và vectors, không `JSON.stringify` theo insertion order. Array order chỉ sort khi semantics là set (modules), không sort rules/priorities.

`packageHash=SHA256(UTF8(canonicalGameplay))`. Engine/ruleset binding thuộc ValidationReport/MatchManifest để một package được revalidate với bộ luật mới; **không** âm thầm sửa package. Cosmetics/name/ownerId/timestamps/BehaviorCard nằm ngoài gameplay hash, có `presentationHash` riêng. Rename chỉ gameplay-equivalent sau remap, compiler digest vẫn pin semantics. Cache key validation dùng tuple tất cả digests, không hash package một mình.

## 4. Brain source: typed FSM + reusable skills

Decoder phải reject duplicate JSON keys ngay khi đọc object, không chỉ JSON.parse rồi validate (JSON.parse đã làm mất duplicate). Rule này áp dụng cùng mọi input canonical trước hash, schema validation và patch.

Chọn FSM có priority rules và pure expressions vì AI dễ sinh JSON, người chơi thấy quyết định, interpreter tính gas xác định. Skill là macro có params typed, compiler inline rồi kiểm giới hạn. Không dùng utility-tree lẫn FSM runtime hai nghĩa; utility selection được viết bằng biến/compare rules hoặc skill macro lowered thành cùng FSM.

```ts
interface BrainSource {
  abiVersion: '2.0'; initialState: string;
  variables: {id:string; type:'int'|'bool'; initial:number|boolean}[];
  skills: SkillDefinition[];
  states: {id:string; rules: Rule[]}[];
}
interface Rule {
  id:string; when: BoolExpr;
  set?: {variable:string; value:Expr}[];
  intent: {thrust:{forward:IntExpr;strafe:IntExpr}; turn:IntExpr;
    modules: ModuleIntent[]};
  nextState?: string;
}
type ModuleIntent =
 | {moduleId:string; action:'activate'; aimOffset:IntExpr; priority:number}
 | {moduleId:string; action:'shieldOn'|'shieldOff'; priority:number};
```

Mỗi rule có toàn bộ intent, không patch intent rule trước. Rule khớp đầu tiên trong state thắng; không match → thrust0, turn0, không module event, không set. `set` đọc snapshot biến đầu decision rồi commit đồng thời, không ghi cùng var hai lần. `nextState` có hiệu lực decision sau; `stateAge` tính **decision count**, đổi sang state khác đặt0; giữ state/self transition tăng1. Initial stateAge0, Brain chạy trước movement tick 0.

**Skill definitions alpha:** `id, parameters:[{id,type}], body:{when,intent,set?,nextState?}`; rule call syntax `{id, useSkill, args}` thay cho `when/intent`, compiler hygienic substitute params và rename internal temps; không recursive calls, call graph DAG. `nextState` trong skill phải là state ref parameter để không bind nhầm caller. T02 có fixture inline equivalence và sourceMap từ IR về rule/skill, compiler fail khi expansion vượt budget. Bản mẫu không dùng skills để giảm bootstrap ambiguity.

## 5. Grammar expressions và sensors

| IntExpr | Định nghĩa |
|---|---|
| `{kind:'const',value:int}` | int32 −2³¹..2³¹−1 |
| `{kind:'var',id}` | Biến int đã khai báo |
| `{kind:'sensor',name}` | Cảm biến int allowlisted |
| `{kind:'op',op,left,right}` | add,sub,mul,div,min,max; saturate int32 |
| `{kind:'clamp',value,min,max}` | min/max IntExpr, min≤max; runtime sai → decisionFault |

`mul/div` intermediate signed64 via BigInt; trunc về0; div0→decisionFault (không arbitrary infinity). BoolExpr: `{kind:'bool',value}`, `{kind:'var',id}` bool, `{kind:'compare',op:eq|ne|lt|lte|gt|gte,left,right}` int hoặc eq/ne bool cùng type; `{kind:'all'|'any',args:[BoolExpr]}` 1..16 short-circuit trái→phải; `{kind:'not',value:BoolExpr}`. Không implicit bool/int cast. Pure expressions không ghi biến. Max depth16 sau inline.

| Sensor | Type/units/visibility |
|---|---|
| `clock.tick`, `clock.decision`, `clock.stateAge` | int; lịch sim/Brain/state |
| `self.energy`, `self.heat`, `self.coreHpPermille` | int; trạng thái private chính mình |
| `self.overheated` | int0/1 để so sánh; không bool cast |
| `self.speed`, `self.x`, `self.y`, `self.heading` | int; milli-unit/s, position, angle0..4095 |
| `self.weaponReady.<moduleId>` | int0/1; static reference resolve lúc compile |
| `self.moduleAlive.<moduleId>` | int0/1; static reference |
| `enemy.distance`, `enemy.bearing` | int milli-unit, signed relative angle−2048..2047 |
| `enemy.speed`, `enemy.heading` | int; world movement công khai |
| `enemy.coreHpPermille` | int công khai; không tiết lộ energy/heat exact |
| `enemy.telegraph` | int0/1 có windup visible, không biết intent chưa kích hoạt |
| `arena.centerBearing`, `arena.centerDistance` | int; mục tiêu positional |
| `arena.controlOwner` | int−1 enemy,0 neutral/contested,1 self |
| `arena.ringRadius`, `self.outsideRing` | int milli-unit,0/1 |

Arena open, enemy pose visible không fog-of-war alpha. Enemy module catalog/HP/destruction visible; không expose Brain/variables, hidden target decisions hoặc future actions. Projectile sensor arrays/query là ABI 2.1 sau slice, alpha dùng nearest hostile projectile tuple `projectile.present/distance/bearing/closingSpeed`, deterministically nearest distance then spawn ordinal; tối đa128 projectiles globally. Sensor snapshot cả hai đầu tick, không quan sát kết quả Brain địch tick hiện tại. Exact enemy energy/heat không đưa trong replay public; UI chỉ overheating flag/thể hiện vũ khí.

Spatial primitive alpha có trong compiler library dạng **skill templates**, không interpreter pathfinding tùy ý: approach/orbit/keepRange/faceBearing dùng int expressions và sensors. Target module aiming nâng cao thêm query ABI 2.1: bounded scan≤24 visible modules sort distance then ordinal. Spec/fixtures phải thêm trước dùng; không tự xuất sensor chưa có trong allowlist.

## 6. Limits, gas và faults

Compiled IR≤2048 nodes, depth16,≤32 states,≤32 rules/state,≤64 variables,≤16 skills, expanded call depth≤4, module intents≤3/decision (shield tính một), literal strings≤48. Gas≤**4096/decision**, mỗi rule visited1, mỗi expr visited1, mỗi module intent1, mỗi assignment1, state transition1; short-circuit tính thực visited. Kiểm gas trước effect, toàn decision atomic.

Giới hạn **trước compiler allocation**: source AST≤4096 nodes, call graph≤64 edges, expression depth≤16, incremental expanded-node counter abort trước node2049; tối đa50.000 compiler work units và wall deadline2s trong process sandbox. Wall deadline là protection compile job, không gameplay gas. Parser bounded256KiB/nesting32 trước parse; validators không lặp recursive unbounded/regex backtracking theo user string. Fail-fast cap phải có negative stress fixtures, không đợi tạo IR cực lớn rồi mới reject.

Over-gas hoặc div0/clampFault: discard writes+state transition+intents, thrust/turn **zero ngay** thay vì giữ drive cũ; tắt shield theo normal upkeep policy chứ fault không miễn phí. `faultStreak++`; decision hợp lệ reset0. **10 liên tiếp** → brainBudget loss (cả hai hòa). Compiler/schema invalid không được vào match. Engine crash, process kill, replay upload fail hoặc wall timeout là **infraFailure**, không bot fault/rating loss; retry cùng manifest.

Memory Bot interpreter bound256KiB, job process limit256MiB, wall cap30s/90s simulated leg là provisional capacity test, không game-time limit. Budget phụ thuộc instruction count, không machine CPU speed. Brain không clock ngoài, I/O, network, host functions, process, prototype mutation, arbitrary import, LLM hay entropy. Variable state reset mỗi leg; không carry học giữa ranked legs.

## 7. Intent arbitration

Trên decision tick, normalize thrust và turn. Module intents sort theo priority int0..15 rồi geometry ordinal; priority 0 cao nhất. Một module không được có hai intents; invalid reference/runtime unavailable → `intentRejected` diagnostic, không consume energy. Không đủ energy cho intent thứ nhất: reject nó rồi thử intent sau, không cancel cả decision. Active costs/heat áp trong order; nếu heat chạm ngưỡng, intent sau bị reject. Arbitration của own bot là quyền chiến thuật công khai, không liên quan slot A/B.

Activate là event một lần, không held signal; thrust/turn là held controls đến decision sau. Disabled module intent không được engine “sửa hộ” sang module khác. Nếu muốn thích nghi mất weapon, Brain phải có rule fallback, và replay phải chứng minh nó.

`aimOffset` được tính thành int rồi **clamp −256..256** cho Burst/Breaker; ghi private diagnostic `aimClamped` nếu vượt. Blade/Lance yêu cầu aim bằng 0: giá trị khác 0 làm module intent bị reject với `AIM_NOT_SUPPORTED`, không tiêu tài nguyên và không gây fault cho toàn decision. Unknown module/action bị reject khi compile/schema validation. Expression không cấp quyền quay turret vượt giới hạn. Fixtures: −257/−256/256/257 và Blade ±1/0. `turn` là signed throttle tới target angular velocity theo 02, không là target angle hay relative bearing.

## 8. Debugging và explainability

Private `DecisionTrace{tick,stateId,ruleId,gas,observationsUsed,varDiff,intent,rejections}` có source map; không log mọi sensor không dùng. Timeline chủ bot gắn decision đến hit/destruction qua attackInstanceId. Explain text do AI sinh phải kèm tick/rule/event refs và gắn “diễn giải”; log là fact, suy luận “nếu làm khác sẽ thắng” phải có counterfactual experiment.

Trace private mã hóa at rest, ACL và thời hạn30 ngày alpha; owner export được. Public replay chỉ pose/public combat events. Trace đối thủ không hiện khi cùng match có chủ mình. Hash public replay không chứa private trace; private trace có hash riêng phục vụ nội bộ. Live spectator delay chỉ là phương án tương lai; alpha phát replay đã tính với nhãn rõ.

## 9. Registry mở rộng lâu dài

```ts
interface ReviewedMechanic {
  mechanicId: string; version: string; digest: string;
  requiredBrainAbi: string; parametersSchemaDigest: string;
  lifecycle: 'laboratory'|'ranked-approved'|'retired';
  deterministicHooks: ('sense'|'intent'|'hit'|'structure')[];
  resourceBudget: {maxEntities:number;maxOpsPerTick:number};
}
```

Extension authored bởi platform developers dưới dạng package TypeScript pure dùng safe integer helpers; không hot-load package của player trên worker ranked. Catalog loader allowlist digest từ release manifest. Hook execution phase order explicit, max ops/entities, state codec/checkpoint version, event schema, property fixtures và performance profile bắt buộc. Không hook access DB/network/time. Đề xuất shield reflect, deployable decoy, sensors/stealth hoặc multi-body cần threat/balance review riêng vì thay đổi visibility/collision/resource semantics.

Laboratory sau alpha có thể hỗ trợ WASM user programs chạy fuel-bound sandbox network-off; đó là ADR riêng, không dùng WASM như lời hứa an toàn tự động. Chỉ promote một mechanic cùng ngân sách cho tất cả người chơi sau benchmark, adversarial test và season notice. ABI 2.x additive operator/sensor,2→3 migration explicit bằng tool; bot cũ giữ package và archived engine để replay, không auto compile khác semantics.

### Extension SDK cho Agent xây mechanic mới (T16)

SDK tương lai cung cấp `registerReviewedMechanic(manifest,hooks)` tại composition/build, không qua player MCP tool. `hooks={sense?,onIntent?,onHit?,onStructure?}` nhận `{tick,readOnlyWorld,ownMechanicState,integerMath,queryBudget}` và trả `{nextMechanicState,effects:Effect[]}`. State namespaced theo `(mechanicDigest,moduleOrdinal)`, codec/version riêng; hook không giữ global mutable state. `Effect` là union typed như `modifyDamagePermille`, `applyStatus`, `spawnProjectile`, `emitPublicEvent`; engine kiểm scope/module, budget, caps, allowed phase, expiry và stable ordinal trước commit. Không trả arbitrary function hoặc direct World reference để mutate.

Mỗi hook call có operation counter và emitted-effect cap; batch effects canonical sorted theo `(phase,tick,mechanicOrdinal,sourceOrdinal,effectOrdinal)`. Effect tạo secondary hit phải scheduled tick sau, không recursive onHit cùng tick. Status stacks/refresh/expire có schema và priority công khai; không negative duration hoặc invisible opponent resources mới. Phần này là contract mục tiêu của SDK mở rộng, **không thêm effects/operators vào ABI alpha** trước T16.

Ví dụ đề xuất `reflective-shield` Laboratory: chỉ reflect projectile có class allowlisted tại cung shield, tiêu energy≥blocked cost, reflection spawn tick sau với maxBounce1; không reflect beam/ring/melee, không infinite shield ping-pong. Agent cung cấp manifest, resource cost/counterplay, new event `projectileReflected`, public cue, private state codec, fixtures simultaneous shield collision/retry/seek và worst-case128entities. Ban đầu không ranked; promote phải catalog version mới+T13/T14-style gates và migration docs. Cách này cho AI developer sáng tạo mechanic bằng SDK có conformance pack thay sửa core bằng nhiều nhánh không kiểm soát.

## 10. Kiểm chứng contract

T02 phải tạo positive/negative vectors cho all grammar nodes; duplicate IDs/fields, float, overflow, poison keys, cycles, source expansion, references, unknown sensor, ordering. T03 kiểm cùng Body 2 Brain thực khác; null/no-match/fault idle semantics; gas boundary4096/4097; simultaneous set;10 fault streak; cooldown giữ và không spam held activate. Canonical hash vectors dùng Node/Linux, browser và Windows CI. Agent không dùng mẫu JSON như substitute cho schema validation.
