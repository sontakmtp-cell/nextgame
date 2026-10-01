import { BotDefinition, CombatEntity, CombatEvent, MatchDebrief, PlacedModule } from '../types/game';
import { MODULE_CATALOG } from '../data/catalog';
import { validateSynth } from '../utils/validation';

export interface Projectile {
  id: string;
  sourceTeam: 'A' | 'B';
  type: 'burst' | 'breaker';
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  heatDamage: number;
  remainingDistance: number;
}

export interface SimulationState {
  tick: number;              // 0..5400
  elapsedSec: number;        // tick / 60
  isFinished: boolean;
  winner: 'A' | 'B' | 'Draw' | null;
  finishReason?: 'core_destroyed' | 'timeout_score';
  ringRadius: number;
  ringWarning: boolean;
  botA: CombatEntity;
  botB: CombatEntity;
  projectiles: Projectile[];
  events: CombatEvent[];
  statsA: { damageDealt: number; modulesLost: number; controlShare: number; peakHeat: number };
  statsB: { damageDealt: number; modulesLost: number; controlShare: number; peakHeat: number };
}

export function createInitialSimulation(
  botDefA: BotDefinition,
  botDefB: BotDefinition,
  swapSides: boolean = false
): SimulationState {
  const valA = validateSynth(botDefA);
  const valB = validateSynth(botDefB);

  const initEntity = (
    team: 'A' | 'B',
    def: BotDefinition,
    val: ReturnType<typeof validateSynth>,
    startX: number,
    startY: number,
    initialHeading: number
  ): CombatEntity => {
    // Clone modules with full HP
    const modules: PlacedModule[] = def.body.modules.map(m => ({
      ...m,
      currentHp: MODULE_CATALOG[m.catalogId]?.hp || 200,
      isDetached: false,
    }));

    return {
      id: `bot-${team}`,
      team,
      botName: def.name,
      definition: def,
      x: startX,
      y: startY,
      heading: initialHeading,
      vx: 0,
      vy: 0,
      angularVelocity: 0,
      energy: val.energyCap,
      maxEnergy: val.energyCap,
      heat: 0,
      maxHeat: 1000,
      isOverheated: false,
      coreHp: 800,
      maxCoreHp: 800,
      modules,
      currentBrainState: def.brain.initialState || 'engage',
      shieldActive: false,
      controlTicks: 0,
    };
  };

  const xA = swapSides ? 12 : -12;
  const xB = swapSides ? -12 : 12;
  const headA = swapSides ? 2048 : 0;  // 0 facing right, 2048 facing left
  const headB = swapSides ? 0 : 2048;

  return {
    tick: 0,
    elapsedSec: 0,
    isFinished: false,
    winner: null,
    ringRadius: 25,
    ringWarning: false,
    botA: initEntity('A', botDefA, valA, xA, 0, headA),
    botB: initEntity('B', botDefB, valB, xB, 0, headB),
    projectiles: [],
    events: [],
    statsA: { damageDealt: 0, modulesLost: 0, controlShare: 0, peakHeat: 0 },
    statsB: { damageDealt: 0, modulesLost: 0, controlShare: 0, peakHeat: 0 },
  };
}

export function stepSimulation(state: SimulationState): SimulationState {
  if (state.isFinished) return state;

  const tick = state.tick + 1;
  const elapsedSec = tick / 60;
  const events = [...state.events];

  const botA = { ...state.botA };
  const botB = { ...state.botB };
  let projectiles = [...state.projectiles];

  // 1. Resources: Regen & Cooling
  const applyResources = (bot: CombatEntity) => {
    // Regen 2 energy/tick
    bot.energy = Math.min(bot.maxEnergy, bot.energy + 2);

    // Heat cooling: base 1/tick + 1 per active radiator
    let radiatorCount = 0;
    for (const m of bot.modules) {
      if (m.catalogId === 'radiator' && !m.isDetached && (m.currentHp || 0) > 0) {
        radiatorCount++;
      }
    }
    const cooling = 1 + radiatorCount;
    bot.heat = Math.max(0, bot.heat - cooling);

    if (bot.isOverheated && bot.heat <= 600) {
      bot.isOverheated = false;
    }
    if (bot.heat >= 1000) {
      bot.isOverheated = true;
      bot.shieldActive = false;
    }

    // Shield upkeep
    if (bot.shieldActive) {
      if (bot.energy >= 1 && !bot.isOverheated) {
        bot.energy -= 1;
      } else {
        bot.shieldActive = false;
      }
    }
  };

  applyResources(botA);
  applyResources(botB);

  // Track peak heat
  state.statsA.peakHeat = Math.max(state.statsA.peakHeat, botA.heat);
  state.statsB.peakHeat = Math.max(state.statsB.peakHeat, botB.heat);

  // 2. Brain Decision Loop (10 Hz = every 6 ticks: 0, 6, 12...)
  if (tick % 6 === 0) {
    const runBrain = (self: CombatEntity, enemy: CombatEntity) => {
      const dx = enemy.x - self.x;
      const dy = enemy.y - self.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const enemyAngleRad = Math.atan2(dy, dx);
      const selfAngleRad = (self.heading / 4096) * Math.PI * 2;
      let relAngleRad = enemyAngleRad - selfAngleRad;
      while (relAngleRad > Math.PI) relAngleRad -= Math.PI * 2;
      while (relAngleRad < -Math.PI) relAngleRad += Math.PI * 2;
      const bearing = Math.round((relAngleRad / (Math.PI * 2)) * 4096);

      // Simple heuristic based on bot archetype brain
      const currentStateObj = self.definition.brain.states.find(s => s.id === self.currentBrainState);
      if (!currentStateObj) return;

      for (const rule of currentStateObj.rules) {
        // Evaluate condition
        let matched = false;
        if (rule.when.kind === 'bool') {
          matched = rule.when.value;
        } else if (rule.when.kind === 'compare') {
          const comp = rule.when;
          let leftVal = 0;
          if (comp.left.kind === 'sensor') {
            if (comp.left.name === 'enemy.distance') leftVal = dist * 1000;
            if (comp.left.name === 'enemy.telegraph') leftVal = enemy.activeTelegraph ? 1 : 0;
            if (comp.left.name === 'self.heat') leftVal = self.heat;
            if (comp.left.name === 'arena.centerDistance') {
              const cDist = Math.sqrt(self.x * self.x + self.y * self.y);
              leftVal = cDist * 1000;
            }
          }
          let rightVal = comp.right.kind === 'const' ? comp.right.value : 0;

          if (comp.op === 'lt') matched = leftVal < rightVal;
          if (comp.op === 'lte') matched = leftVal <= rightVal;
          if (comp.op === 'gt') matched = leftVal > rightVal;
          if (comp.op === 'gte') matched = leftVal >= rightVal;
          if (comp.op === 'eq') matched = leftVal === rightVal;
        }

        if (matched) {
          // Apply intent
          const thrustFwd = (rule.intent.thrust.forward.kind === 'const' ? rule.intent.thrust.forward.value : 500) / 1000;
          const thrustStr = (rule.intent.thrust.strafe.kind === 'const' ? rule.intent.thrust.strafe.value : 0) / 1000;
          
          // Steer towards enemy or center
          let turnAngle = 0;
          if (rule.intent.turn.kind === 'sensor') {
            if (rule.intent.turn.name === 'enemy.bearing') {
              turnAngle = bearing;
            } else if (rule.intent.turn.name === 'arena.centerBearing') {
              const cAngleRad = Math.atan2(-self.y, -self.x);
              let relCAngle = cAngleRad - selfAngleRad;
              while (relCAngle > Math.PI) relCAngle -= Math.PI * 2;
              while (relCAngle < -Math.PI) relCAngle += Math.PI * 2;
              turnAngle = Math.round((relCAngle / (Math.PI * 2)) * 4096);
            }
          }
          const targetAngVel = (turnAngle / 2048) * 0.12;
          self.angularVelocity = self.angularVelocity * 0.7 + targetAngVel * 0.3;

          // Velocity approach
          const rad = (self.heading / 4096) * Math.PI * 2;
          const fwdX = Math.cos(rad);
          const fwdY = Math.sin(rad);
          const strX = -Math.sin(rad);
          const strY = Math.cos(rad);

          const desiredVx = (fwdX * thrustFwd + strX * thrustStr) * 4.5;
          const desiredVy = (fwdY * thrustFwd + strY * thrustStr) * 4.5;

          self.vx = self.vx * 0.85 + desiredVx * 0.15;
          self.vy = self.vy * 0.85 + desiredVy * 0.15;

          // Modules activation
          for (const mi of rule.intent.modules) {
            if (mi.action === 'shieldOn' && !self.isOverheated) {
              self.shieldActive = true;
            } else if (mi.action === 'shieldOff') {
              self.shieldActive = false;
            } else if (mi.action === 'activate' && !self.isOverheated && !self.activeTelegraph) {
              const mod = self.modules.find(m => m.id === mi.moduleId && !m.isDetached && (m.currentHp || 0) > 0);
              if (mod) {
                const cat = MODULE_CATALOG[mod.catalogId];
                if (cat?.weaponStats && self.energy >= cat.weaponStats.energyCost) {
                  self.energy -= cat.weaponStats.energyCost;
                  self.heat += cat.weaponStats.heatCost;
                  self.activeTelegraph = {
                    moduleId: mod.id,
                    type: mod.catalogId as any,
                    currentTick: 0,
                    windupTicks: cat.weaponStats.windup,
                  };
                  events.push({
                    id: `evt-${tick}-${self.team}-windup`,
                    tick,
                    timeSec: elapsedSec,
                    type: 'windup',
                    sourceTeam: self.team,
                    description: `[Đội ${self.team}] ${self.botName} bắt đầu lên nòng ${cat.vietnameseName} (Windup ${cat.weaponStats.windup} ticks)`,
                    moduleId: mod.id,
                  });
                }
              }
            }
          }

          if (rule.nextState) {
            self.currentBrainState = rule.nextState;
          }
          break; // First rule that matches wins
        }
      }
    };

    runBrain(botA, botB);
    runBrain(botB, botA);
  }

  // 3. Movement integration & Arena walls
  const integrateMovement = (bot: CombatEntity) => {
    bot.heading = (bot.heading + Math.round(bot.angularVelocity * 200) + 4096) % 4096;
    bot.x += bot.vx * (1 / 60);
    bot.y += bot.vy * (1 / 60);

    // Wall collision (Arena 40 x 28 => x in [-18, 18], y in [-12, 12])
    const pad = 2.0;
    if (bot.x < -20 + pad) { bot.x = -20 + pad; bot.vx *= -0.5; }
    if (bot.x > 20 - pad) { bot.x = 20 - pad; bot.vx *= -0.5; }
    if (bot.y < -14 + pad) { bot.y = -14 + pad; bot.vy *= -0.5; }
    if (bot.y > 14 - pad) { bot.y = 14 - pad; bot.vy *= -0.5; }
  };

  integrateMovement(botA);
  integrateMovement(botB);

  // Repel bots if too close (Body collision)
  const bdx = botB.x - botA.x;
  const bdy = botB.y - botA.y;
  const botDist = Math.sqrt(bdx * bdx + bdy * bdy);
  if (botDist < 1.6 && botDist > 0.01) {
    const push = (1.6 - botDist) * 0.5;
    const nx = bdx / botDist;
    const ny = bdy / botDist;
    botA.x -= nx * push;
    botA.y -= ny * push;
    botB.x += nx * push;
    botB.y += ny * push;
  }

  // 4. Weapons telegraph progression & strike execution
  const processWeapons = (attacker: CombatEntity, defender: CombatEntity) => {
    if (!attacker.activeTelegraph) return;

    attacker.activeTelegraph.currentTick++;
    if (attacker.activeTelegraph.currentTick >= attacker.activeTelegraph.windupTicks) {
      // Windup finished! Execute active strike!
      const tel = attacker.activeTelegraph;
      const mod = attacker.modules.find(m => m.id === tel.moduleId);
      const cat = mod ? MODULE_CATALOG[mod.catalogId] : null;

      if (cat?.weaponStats) {
        if (tel.type === 'blade' || tel.type === 'lance') {
          // Melee range check
          const dist = Math.sqrt(
            Math.pow(defender.x - attacker.x, 2) + Math.pow(defender.y - attacker.y, 2)
          );
          const reach = cat.weaponStats.reachOrRange + 1.6; // reach + bounding radius
          if (dist <= reach) {
            let dmg = cat.weaponStats.damage;

            // Shield mitigation
            if (defender.shieldActive) {
              const blocked = Math.floor(dmg * 0.7);
              dmg -= blocked;
              defender.energy = Math.max(0, defender.energy - Math.ceil(blocked / 2));
              events.push({
                id: `evt-${tick}-shield`,
                tick,
                timeSec: elapsedSec,
                type: 'shield_block',
                sourceTeam: defender.team,
                targetTeam: attacker.team,
                description: `[Đội ${defender.team}] Khiên Barrier giảm ${blocked} sát thương từ ${cat.vietnameseName}`,
              });
            }

            // Damage random active module or Core
            const targetable = defender.modules.filter(m => !m.isDetached && (m.currentHp || 0) > 0);
            if (targetable.length > 0) {
              const target = targetable[Math.floor(Math.random() * targetable.length)];
              target.currentHp = (target.currentHp || 200) - dmg;

              events.push({
                id: `evt-${tick}-hit`,
                tick,
                timeSec: elapsedSec,
                type: 'hit',
                sourceTeam: attacker.team,
                targetTeam: defender.team,
                damage: dmg,
                description: `[Đội ${attacker.team}] ${cat.vietnameseName} chém trúng ${MODULE_CATALOG[target.catalogId]?.vietnameseName || target.id} gây ${dmg} sát thương!`,
              });

              if (target.catalogId === 'core') {
                defender.coreHp = Math.max(0, defender.coreHp - dmg);
              }

              if ((target.currentHp || 0) <= 0) {
                target.isDetached = true;
                if (target.catalogId === 'core') defender.coreHp = 0;
                events.push({
                  id: `evt-${tick}-broken`,
                  tick,
                  timeSec: elapsedSec,
                  type: 'module_destroyed',
                  sourceTeam: attacker.team,
                  targetTeam: defender.team,
                  description: `💥 [Đội ${defender.team}] Module ${MODULE_CATALOG[target.catalogId]?.vietnameseName || target.id} bị phá hủy hoàn toàn!`,
                });
                if (defender.team === 'A') state.statsA.modulesLost++;
                else state.statsB.modulesLost++;
              }

              if (attacker.team === 'A') state.statsA.damageDealt += dmg;
              else state.statsB.damageDealt += dmg;
            }
          }
        } else if (tel.type === 'burst') {
          // Spawn 3 projectiles
          const rad = (attacker.heading / 4096) * Math.PI * 2;
          const spd = 16.0;
          for (let i = 0; i < 3; i++) {
            const spread = (i - 1) * 0.1;
            projectiles.push({
              id: `proj-${tick}-${attacker.team}-${i}`,
              sourceTeam: attacker.team,
              type: 'burst',
              x: attacker.x + Math.cos(rad) * 1.5,
              y: attacker.y + Math.sin(rad) * 1.5,
              vx: Math.cos(rad + spread) * spd,
              vy: Math.sin(rad + spread) * spd,
              damage: 32,
              heatDamage: 0,
              remainingDistance: 12.0,
            });
          }
        } else if (tel.type === 'breaker') {
          const rad = (attacker.heading / 4096) * Math.PI * 2;
          projectiles.push({
            id: `proj-${tick}-${attacker.team}-breaker`,
            sourceTeam: attacker.team,
            type: 'breaker',
            x: attacker.x + Math.cos(rad) * 1.5,
            y: attacker.y + Math.sin(rad) * 1.5,
            vx: Math.cos(rad) * 14.0,
            vy: Math.sin(rad) * 14.0,
            damage: 60,
            heatDamage: 180,
            remainingDistance: 8.0,
          });
        }
      }

      attacker.activeTelegraph = undefined;
    }
  };

  processWeapons(botA, botB);
  processWeapons(botB, botA);

  // 5. Update projectiles
  const nextProjectiles: Projectile[] = [];
  for (const p of projectiles) {
    p.x += p.vx * (1 / 60);
    p.y += p.vy * (1 / 60);
    p.remainingDistance -= Math.sqrt(p.vx * p.vx + p.vy * p.vy) * (1 / 60);

    const targetBot = p.sourceTeam === 'A' ? botB : botA;
    const pDist = Math.sqrt(Math.pow(p.x - targetBot.x, 2) + Math.pow(p.y - targetBot.y, 2));

    if (pDist < 1.6) {
      // Hit!
      let dmg = p.damage;
      if (targetBot.shieldActive) {
        const blocked = Math.floor(dmg * 0.7);
        dmg -= blocked;
        targetBot.energy = Math.max(0, targetBot.energy - Math.ceil(blocked / 2));
      }

      const activeMods = targetBot.modules.filter(m => !m.isDetached && (m.currentHp || 0) > 0);
      if (activeMods.length > 0) {
        const hitMod = activeMods[Math.floor(Math.random() * activeMods.length)];
        hitMod.currentHp = (hitMod.currentHp || 200) - dmg;
        if (p.heatDamage > 0) {
          targetBot.heat = Math.min(1000, targetBot.heat + p.heatDamage);
          events.push({
            id: `evt-${tick}-heat-spike`,
            tick,
            timeSec: elapsedSec,
            type: 'overheat',
            sourceTeam: p.sourceTeam,
            targetTeam: targetBot.team,
            description: `🔥 [Đội ${targetBot.team}] Bị dội ${p.heatDamage} Heat từ đạn Breaker! (Nhiệt độ: ${targetBot.heat}/1000)`,
          });
        }

        if ((hitMod.currentHp || 0) <= 0) {
          hitMod.isDetached = true;
          if (hitMod.catalogId === 'core') targetBot.coreHp = 0;
          events.push({
            id: `evt-${tick}-destroyed`,
            tick,
            timeSec: elapsedSec,
            type: 'module_destroyed',
            sourceTeam: p.sourceTeam,
            targetTeam: targetBot.team,
            description: `💥 [Đội ${targetBot.team}] Module ${MODULE_CATALOG[hitMod.catalogId]?.vietnameseName || hitMod.id} bị bắn gãy!`,
          });
          if (targetBot.team === 'A') state.statsA.modulesLost++;
          else state.statsB.modulesLost++;
        }

        if (p.sourceTeam === 'A') state.statsA.damageDealt += dmg;
        else state.statsB.damageDealt += dmg;
      }
    } else if (p.remainingDistance > 0 && Math.abs(p.x) < 20 && Math.abs(p.y) < 14) {
      nextProjectiles.push(p);
    }
  }
  projectiles = nextProjectiles;

  // 6. Center Objective Control (Radius 3, starts at tick 600 = 10s)
  if (tick >= 600) {
    const distA = Math.sqrt(botA.x * botA.x + botA.y * botA.y);
    const distB = Math.sqrt(botB.x * botB.x + botB.y * botB.y);
    const insideA = distA <= 3.0;
    const insideB = distB <= 3.0;

    if (insideA && !insideB) {
      botA.controlTicks++;
    } else if (insideB && !insideA) {
      botB.controlTicks++;
    }
  }

  // 7. Ring of Fire (Shrinks from tick 3600 = 60s)
  let ringRadius = 25;
  let ringWarning = false;
  if (tick >= 3480) ringWarning = true;
  if (tick >= 3600) {
    const t = Math.min(1800, tick - 3600);
    ringRadius = Math.max(6, 25 - (19 * t) / 1800);

    // Apply ring damage if outside
    const dCoreA = Math.sqrt(botA.x * botA.x + botA.y * botA.y);
    const dCoreB = Math.sqrt(botB.x * botB.x + botB.y * botB.y);

    if (dCoreA > ringRadius) {
      botA.coreHp = Math.max(0, botA.coreHp - 1);
      if (tick % 60 === 0) {
        events.push({
          id: `evt-${tick}-ring-a`,
          tick,
          timeSec: elapsedSec,
          type: 'ring_damage',
          sourceTeam: 'A',
          description: `⚠️ [Đội A] Nằm ngoài vòng bo! Core bị ăn mòn năng lượng.`,
        });
      }
    }
    if (dCoreB > ringRadius) {
      botB.coreHp = Math.max(0, botB.coreHp - 1);
      if (tick % 60 === 0) {
        events.push({
          id: `evt-${tick}-ring-b`,
          tick,
          timeSec: elapsedSec,
          type: 'ring_damage',
          sourceTeam: 'B',
          description: `⚠️ [Đội B] Nằm ngoài vòng bo! Core bị ăn mòn năng lượng.`,
        });
      }
    }
  }

  // 8. Victory & Termination checks
  let isFinished = false;
  let winner: 'A' | 'B' | 'Draw' | null = null;
  let finishReason: 'core_destroyed' | 'timeout_score' | undefined = undefined;

  if (botA.coreHp <= 0 && botB.coreHp <= 0) {
    isFinished = true;
    winner = 'Draw';
    finishReason = 'core_destroyed';
  } else if (botA.coreHp <= 0) {
    isFinished = true;
    winner = 'B';
    finishReason = 'core_destroyed';
  } else if (botB.coreHp <= 0) {
    isFinished = true;
    winner = 'A';
    finishReason = 'core_destroyed';
  } else if (tick >= 5400) {
    // 90s Timeout Score: score = 5*C + 3*D + 2*H (0..10000)
    isFinished = true;
    finishReason = 'timeout_score';

    const cA = Math.min(1000, Math.floor((botA.controlTicks * 1000) / 4800));
    const cB = Math.min(1000, Math.floor((botB.controlTicks * 1000) / 4800));

    const dA = Math.min(1000, Math.floor((state.statsA.damageDealt * 1000) / 2500));
    const dB = Math.min(1000, Math.floor((state.statsB.damageDealt * 1000) / 2500));

    const hA = Math.floor((botA.coreHp * 1000) / 800);
    const hB = Math.floor((botB.coreHp * 1000) / 800);

    const scoreA = 5 * cA + 3 * dA + 2 * hA;
    const scoreB = 5 * cB + 3 * dB + 2 * hB;

    if (Math.abs(scoreA - scoreB) <= 100) {
      winner = 'Draw';
    } else if (scoreA > scoreB) {
      winner = 'A';
    } else {
      winner = 'B';
    }
  }

  if (isFinished && winner) {
    events.push({
      id: `evt-${tick}-victory`,
      tick,
      timeSec: elapsedSec,
      type: 'victory',
      sourceTeam: winner === 'A' ? 'A' : 'B',
      description: `🏆 TRẬN ĐẤU KẾT THÚC! ${
        winner === 'Draw'
          ? 'Kết quả HÒA'
          : `Chiến thắng thuộc về [Đội ${winner}] ${winner === 'A' ? botA.botName : botB.botName}`
      } (${finishReason === 'core_destroyed' ? 'Phá hủy Lõi Core' : 'Tính điểm Timeout 5C+3D+2H'})`,
    });
  }

  return {
    tick,
    elapsedSec,
    isFinished,
    winner,
    finishReason,
    ringRadius,
    ringWarning,
    botA,
    botB,
    projectiles,
    events,
    statsA: state.statsA,
    statsB: state.statsB,
  };
}

export function generateDebrief(state: SimulationState): MatchDebrief {
  const cA = Math.min(1000, Math.floor((state.botA.controlTicks * 1000) / 4800));
  const cB = Math.min(1000, Math.floor((state.botB.controlTicks * 1000) / 4800));
  const dA = Math.min(1000, Math.floor((state.statsA.damageDealt * 1000) / 2500));
  const dB = Math.min(1000, Math.floor((state.statsB.damageDealt * 1000) / 2500));
  const hA = Math.floor((state.botA.coreHp * 1000) / 800);
  const hB = Math.floor((state.botB.coreHp * 1000) / 800);

  const scoreA = 5 * cA + 3 * dA + 2 * hA;
  const scoreB = 5 * cB + 3 * dB + 2 * hB;

  // Find 3 major turning points from events
  const keyEvents = state.events.filter(e =>
    ['module_destroyed', 'shield_block', 'overheat', 'victory'].includes(e.type)
  ).slice(0, 3);

  const turningPoints = keyEvents.map((evt, idx) => ({
    tick: evt.tick,
    timeSec: evt.timeSec,
    title: `Bước ngoặt ${idx + 1} (${evt.timeSec.toFixed(1)}s)`,
    description: evt.description,
  }));

  if (turningPoints.length === 0) {
    turningPoints.push({
      tick: state.tick,
      timeSec: state.elapsedSec,
      title: 'Giao tranh kết thúc',
      description: 'Hai bên duy trì phòng thủ và tính điểm theo thời gian.',
    });
  }

  return {
    winner: state.winner || 'Draw',
    reason: state.finishReason || 'timeout_score',
    scoreA,
    scoreB,
    durationSec: state.elapsedSec,
    durationTicks: state.tick,
    statsA: {
      damageDealt: state.statsA.damageDealt,
      modulesLost: state.statsA.modulesLost,
      controlShare: Math.round((state.botA.controlTicks / Math.max(1, state.tick)) * 100),
      peakHeat: state.statsA.peakHeat,
    },
    statsB: {
      damageDealt: state.statsB.damageDealt,
      modulesLost: state.statsB.modulesLost,
      controlShare: Math.round((state.botB.controlTicks / Math.max(1, state.tick)) * 100),
      peakHeat: state.statsB.peakHeat,
    },
    turningPoints,
  };
}
