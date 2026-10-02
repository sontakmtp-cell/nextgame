import { ContractError } from '@prompt-chien/contracts';
import type { BotDefinition } from '@prompt-chien/contracts';
import { catalog, contentManifest } from '@content';
import { freezeBot } from '@brain';
import { createWorld, simulate } from '@engine';
import { encodeReplay } from '@replay';
import type {
  ExperimentRunResult,
  ExperimentScenarioResult,
  PrivateTraceStep,
  SimulationPayload,
  WorkerRequest,
} from './types.js';

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === 'validate') {
      try {
        const pkg = await freezeBot(
          req.bot,
          catalog,
          contentManifest.catalogDigest,
          contentManifest.capabilityDigest
        );
        self.postMessage({
          id: req.id,
          type: 'validate_success',
          valid: true,
          packageHash: pkg.packageHash,
          modules: req.bot.body.modules,
        });
      } catch (err) {
        if (err instanceof ContractError) {
          self.postMessage({
            id: req.id,
            type: 'validate_error',
            valid: false,
            error: err.message,
            pointer: err.pointer,
          });
        } else {
          self.postMessage({
            id: req.id,
            type: 'validate_error',
            valid: false,
            error: String(err),
          });
        }
      }
    } else if (req.type === 'simulate') {
      const payload = await runSimulation(req.botA, req.botB, req.seed, req.swapped);
      self.postMessage({
        id: req.id,
        type: 'simulate_success',
        data: payload,
      });
    } else if (req.type === 'experiment') {
      const result = await runExperiment(
        req.id,
        req.baseline,
        req.candidate,
        req.opponent,
        req.scenarioCount
      );
      self.postMessage({
        id: req.id,
        type: 'experiment_success',
        data: result,
      });
    }
  } catch (error) {
    self.postMessage({
      id: req.id,
      type: 'worker_error',
      message: String(error),
    });
  }
};

async function runSimulation(
  botA: BotDefinition,
  botB: BotDefinition,
  seed = '00000000000000000000000000000000',
  swapped = false
): Promise<SimulationPayload> {
  const world = await createWorld(botA, botB, seed, swapped);
  const record = await simulate(world);
  const replay = await encodeReplay(record.manifest, record.frames, record.result);

  const traces: PrivateTraceStep[] = record.traces
    .filter(t => t.actor === 'A')
    .map(t => ({
      tick: t.tick,
      actor: t.actor,
      stateId: t.stateId,
      ruleId: t.ruleId ?? null,
      gas: t.gas,
      fault: t.fault !== null,
      observationsUsed: Object.keys(t.observationsUsed),
      varDiff: Object.fromEntries(
        Object.entries(t.varDiff).map(([k, v]) => [k, typeof v === 'boolean' || typeof v === 'number' ? v : Number(v)])
      ),
      rejections: t.rejections,
    }));

  return {
    frames: record.frames,
    result: record.result,
    manifest: record.manifest,
    simulationHash: record.simulationHash,
    publicReplayHash: replay.manifest.publicReplayHash,
    traces,
  };
}

async function runExperiment(
  jobId: string,
  baseline: BotDefinition,
  candidate: BotDefinition,
  opponent: BotDefinition,
  scenarioCount: number
): Promise<ExperimentRunResult> {
  const scenarios: ExperimentScenarioResult[] = [];
  let baselineTotalScore = 0;
  let candidateTotalScore = 0;
  let baselineWins = 0;
  let candidateWins = 0;
  let draws = 0;

  let representativeScenarioIndex = 0;
  let maxScoreDiff = -1;
  let representativeReplay: SimulationPayload | undefined;

  for (let i = 0; i < scenarioCount; i++) {
    const seed = (i + 1).toString(16).padStart(32, '0');

    const baseLeg1 = await runSimulation(baseline, opponent, seed, false);
    const baseLeg2 = await runSimulation(baseline, opponent, seed, true);

    const candLeg1 = await runSimulation(candidate, opponent, seed, false);
    const candLeg2 = await runSimulation(candidate, opponent, seed, true);

    const baseScore = (baseLeg1.result.scores.A + baseLeg2.result.scores.B) / 2;
    const candScore = (candLeg1.result.scores.A + candLeg2.result.scores.B) / 2;

    baselineTotalScore += baseScore;
    candidateTotalScore += candScore;

    if (candScore > baseScore) candidateWins++;
    else if (candScore < baseScore) baselineWins++;
    else draws++;

    const delta = candScore - baseScore;
    if (Math.abs(delta) > maxScoreDiff || !representativeReplay) {
      maxScoreDiff = Math.abs(delta);
      representativeScenarioIndex = i;
      representativeReplay = candLeg1;
    }

    scenarios.push({
      scenarioId: baseLeg1.manifest.scenarioId,
      seed,
      leg1: {
        baselineScore: baseLeg1.result.scores.A,
        opponentScore: baseLeg1.result.scores.B,
        winner: baseLeg1.result.winner,
        cause: baseLeg1.result.cause,
      },
      leg2: {
        baselineScore: baseLeg2.result.scores.B,
        opponentScore: baseLeg2.result.scores.A,
        winner: baseLeg2.result.winner === 'A' ? 'B' : baseLeg2.result.winner === 'B' ? 'A' : 'draw',
        cause: baseLeg2.result.cause,
      },
      candidateLeg1: {
        candidateScore: candLeg1.result.scores.A,
        opponentScore: candLeg1.result.scores.B,
        winner: candLeg1.result.winner,
        cause: candLeg1.result.cause,
      },
      candidateLeg2: {
        candidateScore: candLeg2.result.scores.B,
        opponentScore: candLeg2.result.scores.A,
        winner: candLeg2.result.winner === 'A' ? 'B' : candLeg2.result.winner === 'B' ? 'A' : 'draw',
        cause: candLeg2.result.cause,
      },
      scoreDelta: delta,
    });

    self.postMessage({
      id: jobId,
      type: 'experiment_progress',
      current: i + 1,
      total: scenarioCount,
    });
  }

  const baselineMean = baselineTotalScore / scenarioCount;
  const candidateMean = candidateTotalScore / scenarioCount;

  return {
    id: `exp-${Date.now()}`,
    timestamp: new Date().toISOString(),
    draftId: candidate.name,
    baselineName: baseline.name,
    candidateName: candidate.name,
    opponentName: opponent.name,
    scenariosCount: scenarioCount,
    baselineMeanScore: Math.round(baselineMean),
    candidateMeanScore: Math.round(candidateMean),
    scoreDelta: Math.round(candidateMean - baselineMean),
    baselineWins,
    candidateWins,
    draws,
    representativeScenarioIndex,
    representativeReplay: representativeReplay ?? undefined,
    scenarios,
  };
}
