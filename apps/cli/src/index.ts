#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseJsonRejectDuplicates,
  validateBotDefinition,
  createCanonicalGameplay,
  BotDefinition,
  MatchManifest,
} from '@nextgame/contracts';
import { REFERENCE_BOTS, deriveScenarioFromSeed } from '@nextgame/content';
import { MatchSimulation } from '@nextgame/engine';
import { buildMatchReplay, verifyReplayIntegrity } from '@nextgame/replay';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
PROMPT Chiến CLI v2.0 - Headless Toolchain

Usage:
  nextgame validate <bot.json>
  nextgame simulate [botA.json] [botB.json] [--seed <hex>] [--out <replay.json>]
  nextgame experiment [--count <N>]
  nextgame verify <replay.json>
`);
}

switch (command) {
  case 'validate': {
    const filePath = args[1];
    if (!filePath) {
      console.error('Error: missing path to bot JSON file');
      process.exit(1);
    }
    try {
      const content = readFileSync(resolve(filePath), 'utf8');
      const bot = parseJsonRejectDuplicates<BotDefinition>(content);
      const report = validateBotDefinition(bot);

      console.log(`\n=== Validation Report: ${bot.name} ===`);
      console.log(`Valid: ${report.isValid ? 'YES' : 'NO'}`);
      console.log(`Modules: ${report.totalModules}/24 | Cost: ${report.totalCost}/100 pts | Mass: ${report.totalMass}`);
      console.log(`Bounding Radius: ${report.boundingRadiusMilli} mU (max 6500)`);
      console.log(`Connected: ${report.isConnected} | Core Found: ${report.coreFound}`);
      console.log(`Weapons: ${report.weaponCount}/3 | Thrusters: ${report.thrusterCount}/6`);

      if (report.isValid) {
        const canonical = createCanonicalGameplay(bot);
        console.log(`Package Hash (SHA-256): ${canonical.packageHash}`);
      } else {
        console.log('\nErrors:');
        for (const err of report.errors) {
          console.log(` - [${err.code}] ${err.message}`);
        }
        process.exit(1);
      }
    } catch (err: any) {
      console.error(`Validation failed: ${err.message}`);
      process.exit(1);
    }
    break;
  }

  case 'simulate': {
    let botA: BotDefinition = REFERENCE_BOTS.mantis;
    let botB: BotDefinition = REFERENCE_BOTS.bastion;

    const positional: string[] = [];
    for (let i = 1; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        i++; // skip flag value
        continue;
      }
      positional.push(args[i]);
    }
    if (positional[0]) {
      botA = parseJsonRejectDuplicates<BotDefinition>(readFileSync(resolve(positional[0]), 'utf8'));
    }
    if (positional[1]) {
      botB = parseJsonRejectDuplicates<BotDefinition>(readFileSync(resolve(positional[1]), 'utf8'));
    }

    const seedArgIdx = args.indexOf('--seed');
    let seedBytes = new Uint8Array(16);
    if (seedArgIdx !== -1 && args[seedArgIdx + 1]) {
      const hex = args[seedArgIdx + 1];
      for (let i = 0; i < 16; i++) {
        seedBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
      }
    } else {
      seedBytes[0] = 0x42; seedBytes[1] = 0x99;
    }

    const { scenarioId, preset } = deriveScenarioFromSeed(seedBytes);
    const hashA = createCanonicalGameplay(botA).packageHash;
    const hashB = createCanonicalGameplay(botB).packageHash;

    const manifest: MatchManifest = {
      engineDigest: 'sha256:alpha0_engine_v2',
      rulesetDigest: 'sha256:alpha0_ruleset_v2',
      catalogDigest: 'sha256:alpha0_catalog_v2',
      brainAbiVersion: '2.0',
      packageHashA: hashA,
      packageHashB: hashB,
      seed: Array.from(seedBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
      scenarioId,
      presetValues: {
        yLeft: preset.yLeft,
        yRight: preset.yRight,
        jitterLeft: preset.jitterLeft,
        jitterRight: preset.jitterRight,
      },
      spawnSlotAssignment: 'leg0_standard',
      maxTicks: 5400,
    };

    console.log(`\n=== Starting Match: ${botA.name} vs ${botB.name} ===`);
    console.log(`Scenario ID: ${scenarioId} | Seed: ${manifest.seed}`);

    const sim = new MatchSimulation(manifest, botA, botB);
    const outcome = sim.runToCompletion();

    console.log(`\n=== Match Finished ===`);
    console.log(`Total Ticks: ${sim.tick} / 5400 (${(sim.tick / 60).toFixed(1)}s)`);
    console.log(`Winner: ${outcome.winner} (Reason: ${outcome.reason})`);
    console.log(`Control Ticks: Bot A=${sim.objectives.controlTicksA}, Bot B=${sim.objectives.controlTicksB}`);
    console.log(`Damage Dealt: Bot A=${sim.botA.resources.damageDealt}, Bot B=${sim.botB.resources.damageDealt}`);

    const outArgIdx = args.indexOf('--out');
    if (outArgIdx !== -1 && args[outArgIdx + 1]) {
      const replay = buildMatchReplay(manifest, sim.replayFrames, outcome);
      writeFileSync(resolve(args[outArgIdx + 1]), JSON.stringify(replay, null, 2), 'utf8');
      console.log(`Replay written to ${args[outArgIdx + 1]} (Public Hash: ${replay.publicReplayHash})`);
    }
    break;
  }

  case 'experiment': {
    const countArgIdx = args.indexOf('--count');
    const count = countArgIdx !== -1 ? parseInt(args[countArgIdx + 1], 10) || 10 : 10;

    console.log(`\n=== Running A/B Balance Experiment (${count} matches: Mantis vs Bastion) ===`);
    const botA = REFERENCE_BOTS.mantis;
    const botB = REFERENCE_BOTS.bastion;

    let winsA = 0;
    let winsB = 0;
    let draws = 0;

    for (let i = 0; i < count; i++) {
      const seedBytes = new Uint8Array(16);
      seedBytes[0] = (i + 1) & 0xff;
      seedBytes[1] = ((i + 1) * 31) & 0xff;

      const { scenarioId, preset } = deriveScenarioFromSeed(seedBytes);
      const manifest: MatchManifest = {
        engineDigest: 'sha256:alpha0_engine_v2',
        rulesetDigest: 'sha256:alpha0_ruleset_v2',
        catalogDigest: 'sha256:alpha0_catalog_v2',
        brainAbiVersion: '2.0',
        packageHashA: createCanonicalGameplay(botA).packageHash,
        packageHashB: createCanonicalGameplay(botB).packageHash,
        seed: Array.from(seedBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
        scenarioId,
        presetValues: {
          yLeft: preset.yLeft,
          yRight: preset.yRight,
          jitterLeft: preset.jitterLeft,
          jitterRight: preset.jitterRight,
        },
        spawnSlotAssignment: (i % 2 === 0 ? 'leg0_standard' : 'leg1_swapped'),
        maxTicks: 5400,
      };

      const sim = new MatchSimulation(manifest, botA, botB);
      const outcome = sim.runToCompletion();

      if (outcome.winner === 'botA') winsA++;
      else if (outcome.winner === 'botB') winsB++;
      else draws++;
    }

    console.log(`\n=== Experiment Results ===`);
    console.log(`Total Runs: ${count}`);
    console.log(`Mantis Wins: ${winsA} (${((winsA / count) * 100).toFixed(1)}%)`);
    console.log(`Bastion Wins: ${winsB} (${((winsB / count) * 100).toFixed(1)}%)`);
    console.log(`Draws: ${draws} (${((draws / count) * 100).toFixed(1)}%)`);
    break;
  }

  case 'verify': {
    const replayPath = args[1];
    if (!replayPath) {
      console.error('Error: missing path to replay file');
      process.exit(1);
    }
    try {
      const content = readFileSync(resolve(replayPath), 'utf8');
      const replay = JSON.parse(content);
      const res = verifyReplayIntegrity(replay);
      if (res.isValid) {
        console.log(`Replay integrity VERIFIED: valid chunk hashes and public hash (${replay.publicReplayHash})`);
      } else {
        console.error(`Replay integrity check FAILED: ${res.error}`);
        process.exit(1);
      }
    } catch (err: any) {
      console.error(`Verification error: ${err.message}`);
      process.exit(1);
    }
    break;
  }

  default:
    printHelp();
    break;
}
