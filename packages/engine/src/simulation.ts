// PROMPT Chiến - Headless Deterministic Simulation Loop (ABI v2.0)
// Simulates 60 Hz deterministic matches tick-by-tick.

import {
  BotDefinition,
  MatchManifest,
  ReplayFrame,
  SensorName,
  ModulePlacement,
} from '@nextgame/contracts';
import { BrainCompiler, BrainVM, BrainExecutionContext, CompiledBrainIR } from '@nextgame/brain';
import { CATALOG } from '@nextgame/content';
import {
  normalizeAngle,
  relativeBearing,
  integerAtan2,
  isqrt,
} from './math.js';
import {
  transformBotModules,
  computeBotAABB,
  segmentIntersectsCell,
  TransformedModule,
} from './geometry.js';
import {
  BotKinematicsState,
  calculatePropulsionMetrics,
  integrateMotion,
  resolveWallCollisions,
  resolveBodyCollisions,
} from './physics.js';
import {
  BotCombatResources,
  WeaponState,
  Projectile,
  initCombatResources,
  initWeaponStates,
  tickResources,
  tryActivateWeapon,
  setShieldActive,
  advanceWeaponPhases,
  applyDamageToModule,
} from './combat.js';
import {
  ObjectiveState,
  initObjectiveState,
  updateObjectives,
  calculateTimeoutScore,
  adjudicateTimeout,
  MatchOutcome,
  MAX_MATCH_TICKS,
} from './objective.js';

export interface BotSimState {
  definition: BotDefinition;
  compiledIr: CompiledBrainIR;
  vm: BrainVM;
  vmContext: BrainExecutionContext;
  kinematics: BotKinematicsState;
  resources: BotCombatResources;
  weapons: Map<string, WeaponState>;
  moduleHps: Map<string, number>;
  activeModules: TransformedModule[];
  currentThrust: { forward: number; strafe: number };
  currentTurn: number;
}

export class MatchSimulation {
  public tick = 0;
  public botA: BotSimState;
  public botB: BotSimState;
  public projectiles: Projectile[] = [];
  public objectives: ObjectiveState;
  public replayFrames: ReplayFrame[] = [];
  public outcome?: MatchOutcome;
  private nextProjId = { val: 1 };
  private manifest: MatchManifest;

  constructor(manifest: MatchManifest, botDefA: BotDefinition, botDefB: BotDefinition) {
    this.manifest = manifest;
    this.objectives = initObjectiveState();

    const compiler = new BrainCompiler();
    const compileA = compiler.compile(botDefA.brain);
    const compileB = compiler.compile(botDefB.brain);

    if (!compileA.ir || !compileB.ir) {
      throw new Error('Simulation failed: invalid Brain AST in one or both bots');
    }

    this.botA = this.initBotState('botA', botDefA, compileA.ir, manifest);
    this.botB = this.initBotState('botB', botDefB, compileB.ir, manifest);
  }

  private initBotState(
    slot: 'botA' | 'botB',
    bot: BotDefinition,
    ir: CompiledBrainIR,
    manifest: MatchManifest
  ): BotSimState {
    const moduleHps = new Map<string, number>();
    let totalMass = 0;

    for (const m of bot.body.modules) {
      const cat = CATALOG[m.catalogId];
      const hp = cat ? cat.hp : 100;
      const mass = cat ? cat.mass : 4;
      moduleHps.set(m.id, hp);
      totalMass += mass;
    }

    // Determine spawn pose based on spawnSlotAssignment
    const isSlotA = slot === 'botA';
    const isStandard = manifest.spawnSlotAssignment === 'leg0_standard';
    const isLeft = (isSlotA && isStandard) || (!isSlotA && !isStandard);

    const x = isLeft ? -12_000 : 12_000;
    const y = isLeft ? manifest.presetValues.yLeft : manifest.presetValues.yRight;
    const targetY = isLeft ? manifest.presetValues.yRight : manifest.presetValues.yLeft;
    const targetX = isLeft ? 12_000 : -12_000;

    // Heading pointing towards opponent Core + jitter
    const baseHeading = integerAtan2(targetY - y, targetX - x);
    const jitter = isLeft ? manifest.presetValues.jitterLeft : manifest.presetValues.jitterRight;
    const heading = normalizeAngle(baseHeading + jitter);

    const activeModules = transformBotModules(bot.body.modules, x, y, heading, moduleHps);

    // Initial torque calculation
    const thrusters = activeModules.filter(m => m.catalogId === 'thruster');
    let initialThrusterTorque = 0;
    for (const t of thrusters) {
      const distSq = t.localCenter.x * t.localCenter.x + t.localCenter.y * t.localCenter.y;
      const lever = Math.min(4000, isqrt(distSq));
      initialThrusterTorque += 1000 + lever;
    }

    const kinematics: BotKinematicsState = {
      x,
      y,
      heading,
      vx: 0,
      vy: 0,
      w: 0,
      mass: totalMass,
      initialThrusterTorque,
      residualVx: 0,
      residualVy: 0,
      residualW: 0,
    };

    const initialVars = new Map<string, number | boolean>();
    for (const v of bot.brain.variables) {
      initialVars.set(v.id, v.initial);
    }

    const vmContext: BrainExecutionContext = {
      sensors: {} as any,
      currentState: ir.initialState,
      stateAge: 0,
      variables: initialVars,
      faultStreak: 0,
    };

    return {
      definition: bot,
      compiledIr: ir,
      vm: new BrainVM(),
      vmContext,
      kinematics,
      resources: initCombatResources(activeModules),
      weapons: initWeaponStates(activeModules),
      moduleHps,
      activeModules,
      currentThrust: { forward: 0, strafe: 0 },
      currentTurn: 0,
    };
  }

  public stepTick(): void {
    if (this.outcome) return;

    // 1. Resource regen & cooling at start of tick
    const shieldActiveA = Array.from(this.botA.weapons.values()).some(w => w.isShieldActive);
    const shieldActiveB = Array.from(this.botB.weapons.values()).some(w => w.isShieldActive);
    tickResources(this.botA.resources, shieldActiveA);
    tickResources(this.botB.resources, shieldActiveB);

    // 2. Brain decision tick (10 Hz = every 6 ticks: 0, 6, 12...)
    if (this.tick % 6 === 0) {
      this.executeBrainDecisions();
    }

    // 3. Motion integration & kinematics
    const metricsA = calculatePropulsionMetrics(this.botA.kinematics.mass, this.botA.kinematics.initialThrusterTorque, this.botA.activeModules);
    const metricsB = calculatePropulsionMetrics(this.botB.kinematics.mass, this.botB.kinematics.initialThrusterTorque, this.botB.activeModules);

    integrateMotion(this.botA.kinematics, this.botA.currentThrust, this.botA.currentTurn, metricsA);
    integrateMotion(this.botB.kinematics, this.botB.currentThrust, this.botB.currentTurn, metricsB);

    // Update transformed module positions in world
    this.botA.activeModules = transformBotModules(this.botA.definition.body.modules, this.botA.kinematics.x, this.botA.kinematics.y, this.botA.kinematics.heading, this.botA.moduleHps);
    this.botB.activeModules = transformBotModules(this.botB.definition.body.modules, this.botB.kinematics.x, this.botB.kinematics.y, this.botB.kinematics.heading, this.botB.moduleHps);

    // Collisions
    const aabbA = computeBotAABB(this.botA.activeModules);
    const aabbB = computeBotAABB(this.botB.activeModules);

    resolveWallCollisions(this.botA.kinematics, aabbA);
    resolveWallCollisions(this.botB.kinematics, aabbB);
    resolveBodyCollisions(this.botA.kinematics, aabbA, this.botB.kinematics, aabbB);

    // 4. Advance weapon state machines & spawn projectiles
    advanceWeaponPhases(this.botA.weapons, this.botA.resources, 'botA', this.botA.activeModules, this.projectiles, this.nextProjId);
    advanceWeaponPhases(this.botB.weapons, this.botB.resources, 'botB', this.botB.activeModules, this.projectiles, this.nextProjId);

    // 5. Projectiles simulation & continuous collision
    this.updateProjectiles();

    // 6. Melee Blade attack check
    this.checkMeleeAttacks();

    // 7. Prune disconnected modules (BFS from Core)
    this.pruneDisconnectedModules(this.botA);
    this.pruneDisconnectedModules(this.botB);

    // 8. Objectives (Ring shrink & Control circle)
    const corePosA = { x: this.botA.kinematics.x, y: this.botA.kinematics.y };
    const corePosB = { x: this.botB.kinematics.x, y: this.botB.kinematics.y };
    const coreModA = this.botA.activeModules.find(m => m.catalogId === 'core');
    const coreModB = this.botB.activeModules.find(m => m.catalogId === 'core');

    const coreHpA = { hp: coreModA?.hp ?? 0, maxHp: 800 };
    const coreHpB = { hp: coreModB?.hp ?? 0, maxHp: 800 };

    const { ringDamageA, ringDamageB } = updateObjectives(
      this.tick,
      this.objectives,
      corePosA,
      corePosB,
      coreHpA,
      coreHpB
    );

    if (ringDamageA > 0 && coreModA) {
      coreModA.hp = Math.max(0, coreModA.hp - ringDamageA);
      this.botA.moduleHps.set(coreModA.id, coreModA.hp);
    }
    if (ringDamageB > 0 && coreModB) {
      coreModB.hp = Math.max(0, coreModB.hp - ringDamageB);
      this.botB.moduleHps.set(coreModB.id, coreModB.hp);
    }

    // 9. Record Replay Frame
    this.recordReplayFrame(coreModA?.hp ?? 0, coreModB?.hp ?? 0);

    // 10. Check Terminal Conditions
    this.checkTerminalConditions(coreModA?.hp ?? 0, coreModB?.hp ?? 0);

    this.tick++;
  }

  private executeBrainDecisions(): void {
    // Build sensor observations for Bot A and Bot B
    this.botA.vmContext.sensors = this.buildSensors(this.botA, this.botB);
    this.botB.vmContext.sensors = this.buildSensors(this.botB, this.botA);

    // Run VM decisions
    const decA = this.botA.vm.executeTick(this.botA.compiledIr, this.botA.vmContext);
    const decB = this.botB.vm.executeTick(this.botB.compiledIr, this.botB.vmContext);

    // Update held control thrust and turn
    this.botA.currentThrust = decA.thrust;
    this.botA.currentTurn = decA.turn;
    this.botB.currentThrust = decB.thrust;
    this.botB.currentTurn = decB.turn;

    // Apply module intents for Bot A
    for (const intent of decA.modules) {
      const w = this.botA.weapons.get(intent.moduleId);
      if (w) {
        if (intent.action === 'activate') {
          const aim = intent.aimOffset && intent.aimOffset.kind === 'const' ? intent.aimOffset.value : 0;
          tryActivateWeapon(w, this.botA.resources, aim);
        } else if (intent.action === 'shieldOn') {
          setShieldActive(w, this.botA.resources, true);
        } else if (intent.action === 'shieldOff') {
          setShieldActive(w, this.botA.resources, false);
        }
      }
    }

    // Apply module intents for Bot B
    for (const intent of decB.modules) {
      const w = this.botB.weapons.get(intent.moduleId);
      if (w) {
        if (intent.action === 'activate') {
          const aim = intent.aimOffset && intent.aimOffset.kind === 'const' ? intent.aimOffset.value : 0;
          tryActivateWeapon(w, this.botB.resources, aim);
        } else if (intent.action === 'shieldOn') {
          setShieldActive(w, this.botB.resources, true);
        } else if (intent.action === 'shieldOff') {
          setShieldActive(w, this.botB.resources, false);
        }
      }
    }
  }

  private buildSensors(self: BotSimState, enemy: BotSimState): Record<SensorName, number> {
    const dx = enemy.kinematics.x - self.kinematics.x;
    const dy = enemy.kinematics.y - self.kinematics.y;
    const dist = isqrt(dx * dx + dy * dy);
    const enemyAngle = integerAtan2(dy, dx);
    const bearing = relativeBearing(self.kinematics.heading, enemyAngle);

    const speed = isqrt(self.kinematics.vx * self.kinematics.vx + self.kinematics.vy * self.kinematics.vy);
    const enemySpeed = isqrt(enemy.kinematics.vx * enemy.kinematics.vx + enemy.kinematics.vy * enemy.kinematics.vy);

    const coreMod = self.activeModules.find(m => m.catalogId === 'core');
    const enemyCoreMod = enemy.activeModules.find(m => m.catalogId === 'core');
    const coreHp = coreMod?.hp ?? 0;
    const enemyCoreHp = enemyCoreMod?.hp ?? 0;

    const centerDist = isqrt(self.kinematics.x * self.kinematics.x + self.kinematics.y * self.kinematics.y);
    const centerBearing = relativeBearing(self.kinematics.heading, integerAtan2(-self.kinematics.y, -self.kinematics.x));

    const telegraph = Array.from(enemy.weapons.values()).some(w => w.phase === 'windup') ? 1 : 0;

    return {
      'clock.tick': this.tick,
      'clock.decision': Math.floor(this.tick / 6),
      'clock.stateAge': self.vmContext.stateAge,
      'self.energy': self.resources.energy,
      'self.heat': self.resources.heat,
      'self.coreHpPermille': Math.floor((coreHp * 1000) / 800),
      'self.overheated': self.resources.isOverheated ? 1 : 0,
      'self.speed': speed,
      'self.x': self.kinematics.x,
      'self.y': self.kinematics.y,
      'self.heading': self.kinematics.heading,
      'enemy.distance': dist,
      'enemy.bearing': bearing,
      'enemy.speed': enemySpeed,
      'enemy.heading': enemy.kinematics.heading,
      'enemy.coreHpPermille': Math.floor((enemyCoreHp * 1000) / 800),
      'enemy.telegraph': telegraph,
      'arena.centerBearing': centerBearing,
      'arena.centerDistance': centerDist,
      'arena.controlOwner': 0,
      'arena.ringRadius': this.objectives.currentRingRadius,
      'self.outsideRing': centerDist > this.objectives.currentRingRadius ? 1 : 0,
    };
  }

  private updateProjectiles(): void {
    const aliveProjs: Projectile[] = [];

    for (const p of this.projectiles) {
      const stepDist = Math.floor(18_000 / 60); // 300 milli-units per tick
      const p1 = { x: p.x, y: p.y };
      const p2 = { x: p.x + Math.floor(p.vx / 60), y: p.y + Math.floor(p.vy / 60) };

      p.x = p2.x;
      p.y = p2.y;
      p.remainingRange -= stepDist;

      const defender = p.ownerSlot === 'botA' ? this.botB : this.botA;
      const attacker = p.ownerSlot === 'botA' ? this.botA : this.botB;

      // CCD check against all active defender modules
      let closestHit: { module: TransformedModule; t: number } | null = null;

      for (const m of defender.activeModules) {
        if (!m.isAlive) continue;
        const cellMin = { x: m.worldCenter.x - 500, y: m.worldCenter.y - 500 };
        const cellMax = { x: m.worldCenter.x + 500, y: m.worldCenter.y + 500 };
        const isect = segmentIntersectsCell(p1, p2, cellMin, cellMax);
        if (isect.hit && (closestHit === null || isect.t < closestHit.t)) {
          closestHit = { module: m, t: isect.t };
        }
      }

      if (closestHit) {
        // Hit detected: apply damage and despawn projectile
        const shieldCovering = this.isCoveredByShield(defender, closestHit.module.worldCenter);
        const hpLost = applyDamageToModule(closestHit.module, p.damage, defender.resources, shieldCovering);
        defender.moduleHps.set(closestHit.module.id, closestHit.module.hp);
        attacker.resources.damageDealt += hpLost;
      } else if (p.remainingRange > 0) {
        aliveProjs.push(p);
      }
    }

    this.projectiles = aliveProjs;
  }

  private checkMeleeAttacks(): void {
    this.checkBladeSweep(this.botA, this.botB);
    this.checkBladeSweep(this.botB, this.botA);
  }

  private checkBladeSweep(attacker: BotSimState, defender: BotSimState): void {
    for (const w of attacker.weapons.values()) {
      if (w.catalogId === 'blade' && w.phase === 'active' && !w.hasHitThisCycle) {
        const bladeMod = attacker.activeModules.find(m => m.id === w.moduleId);
        if (!bladeMod || !bladeMod.isAlive) continue;

        // Reach 1.5 units = 1500 milli-units, 90° forward sector (+-512)
        const reachSq = 1500 * 1500;
        let targetMod: TransformedModule | null = null;
        let minTargetDistSq = Infinity;

        for (const defMod of defender.activeModules) {
          if (!defMod.isAlive) continue;
          const dx = defMod.worldCenter.x - bladeMod.worldCenter.x;
          const dy = defMod.worldCenter.y - bladeMod.worldCenter.y;
          const distSq = dx * dx + dy * dy;

          if (distSq <= reachSq && distSq < minTargetDistSq) {
            const bearing = relativeBearing(bladeMod.worldHeading, integerAtan2(dy, dx));
            if (Math.abs(bearing) <= 512) {
              targetMod = defMod;
              minTargetDistSq = distSq;
            }
          }
        }

        if (targetMod) {
          w.hasHitThisCycle = true;
          const shieldCovering = this.isCoveredByShield(defender, targetMod.worldCenter);
          const hpLost = applyDamageToModule(targetMod, 90, defender.resources, shieldCovering);
          defender.moduleHps.set(targetMod.id, targetMod.hp);
          attacker.resources.damageDealt += hpLost;
        }
      }
    }
  }

  private isCoveredByShield(defender: BotSimState, targetPos: { x: number; y: number }): boolean {
    const shield = Array.from(defender.weapons.values()).find(w => w.isShieldActive);
    if (!shield) return false;

    const shieldMod = defender.activeModules.find(m => m.id === shield.moduleId);
    if (!shieldMod || !shieldMod.isAlive) return false;

    const dx = targetPos.x - defender.kinematics.x;
    const dy = targetPos.y - defender.kinematics.y;
    const bearing = relativeBearing(shieldMod.worldHeading, integerAtan2(dy, dx));

    return Math.abs(bearing) <= 512; // 90° forward arc (+-512)
  }

  private pruneDisconnectedModules(bot: BotSimState): void {
    const coreMod = bot.definition.body.modules.find((m: ModulePlacement) => m.catalogId === 'core');
    if (!coreMod) return;

    const visited = new Set<string>();
    const queue: { x: number; y: number }[] = [];

    // Core 2x2 cells
    for (let dx = 0; dx < 2; dx++) {
      for (let dy = 0; dy < 2; dy++) {
        const k = `${coreMod.cell.x + dx},${coreMod.cell.y + dy}`;
        visited.add(k);
        queue.push({ x: coreMod.cell.x + dx, y: coreMod.cell.y + dy });
      }
    }

    const aliveCells = new Map<string, string>();
    for (const m of bot.definition.body.modules) {
      if (m.catalogId === 'core') continue;
      const hp = bot.moduleHps.get(m.id) ?? 0;
      if (hp > 0) {
        aliveCells.set(`${m.cell.x},${m.cell.y}`, m.id);
      }
    }

    const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const d of dirs) {
        const nx = curr.x + d.x;
        const ny = curr.y + d.y;
        const nk = `${nx},${ny}`;
        if (aliveCells.has(nk) && !visited.has(nk)) {
          visited.add(nk);
          queue.push({ x: nx, y: ny });
        }
      }
    }

    // Detach any alive cell that is not visited
    for (const [key, modId] of aliveCells) {
      if (!visited.has(key)) {
        bot.moduleHps.set(modId, 0);
        const m = bot.activeModules.find(mod => mod.id === modId);
        if (m) {
          m.hp = 0;
          m.isAlive = false;
        }
      }
    }
  }

  private recordReplayFrame(coreHpA: number, coreHpB: number): void {
    this.replayFrames.push({
      tick: this.tick,
      poses: {
        botA: {
          x: this.botA.kinematics.x,
          y: this.botA.kinematics.y,
          heading: this.botA.kinematics.heading,
          vx: this.botA.kinematics.vx,
          vy: this.botA.kinematics.vy,
        },
        botB: {
          x: this.botB.kinematics.x,
          y: this.botB.kinematics.y,
          heading: this.botB.kinematics.heading,
          vx: this.botB.kinematics.vx,
          vy: this.botB.kinematics.vy,
        },
      },
      resources: {
        botA: {
          energy: this.botA.resources.energy,
          heat: this.botA.resources.heat,
          coreHp: coreHpA,
          isOverheated: this.botA.resources.isOverheated,
        },
        botB: {
          energy: this.botB.resources.energy,
          heat: this.botB.resources.heat,
          coreHp: coreHpB,
          isOverheated: this.botB.resources.isOverheated,
        },
      },
      events: [],
    });
  }

  private checkTerminalConditions(coreHpA: number, coreHpB: number): void {
    // 1. Core destruction
    if (coreHpA <= 0 && coreHpB <= 0) {
      this.outcome = { winner: 'draw', reason: 'coreDouble' };
      return;
    }
    if (coreHpA <= 0) {
      this.outcome = { winner: 'botB', reason: 'core' };
      return;
    }
    if (coreHpB <= 0) {
      this.outcome = { winner: 'botA', reason: 'core' };
      return;
    }

    // 2. Brain budget loss (10 consecutive faults)
    if (this.botA.vmContext.faultStreak >= 10 && this.botB.vmContext.faultStreak >= 10) {
      this.outcome = { winner: 'draw', reason: 'brainBudget' };
      return;
    }
    if (this.botA.vmContext.faultStreak >= 10) {
      this.outcome = { winner: 'botB', reason: 'brainBudget' };
      return;
    }
    if (this.botB.vmContext.faultStreak >= 10) {
      this.outcome = { winner: 'botA', reason: 'brainBudget' };
      return;
    }

    // 3. Timeout at 5400 ticks
    if (this.tick >= MAX_MATCH_TICKS - 1) {
      const scoreA = calculateTimeoutScore(
        this.objectives.controlTicksA,
        this.botA.resources.damageDealt,
        this.botB.resources.initialTotalHp,
        coreHpA,
        800
      );
      const scoreB = calculateTimeoutScore(
        this.objectives.controlTicksB,
        this.botB.resources.damageDealt,
        this.botA.resources.initialTotalHp,
        coreHpB,
        800
      );
      this.outcome = adjudicateTimeout(scoreA, scoreB);
    }
  }

  public runToCompletion(): MatchOutcome {
    while (!this.outcome && this.tick < MAX_MATCH_TICKS) {
      this.stepTick();
    }
    return this.outcome!;
  }
}
