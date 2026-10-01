// PROMPT Chiến - Replay Codec, Chunks (60 ticks = 1s), Integrity & Seek (ABI v2.0)
// Strips private brain data; public projection only.

import { MatchManifest, ReplayFrame, sha256, stringifyCanonical } from '@nextgame/contracts';

export const TICKS_PER_CHUNK = 60;

export interface ReplayChunk {
  chunkIndex: number;
  startTick: number;
  endTick: number;
  frames: ReplayFrame[];
  chunkHash: string;
}

export interface MatchReplay {
  manifest: MatchManifest;
  totalTicks: number;
  chunkCount: number;
  chunks: ReplayChunk[];
  publicReplayHash: string;
  outcome: {
    winner: 'botA' | 'botB' | 'draw';
    reason: string;
  };
}

/**
 * Builds a chunked public replay archive from raw simulation frames
 */
export function buildMatchReplay(
  manifest: MatchManifest,
  frames: ReplayFrame[],
  outcome: MatchReplay['outcome']
): MatchReplay {
  const chunks: ReplayChunk[] = [];
  const totalFrames = frames.length;
  let chunkIdx = 0;

  for (let offset = 0; offset < totalFrames; offset += TICKS_PER_CHUNK) {
    const chunkFrames = frames.slice(offset, offset + TICKS_PER_CHUNK);
    const startTick = offset;
    const endTick = offset + chunkFrames.length - 1;

    // Public projection: sanitize frames if necessary
    const sanitizedFrames = chunkFrames.map(f => ({
      tick: f.tick,
      poses: f.poses,
      resources: {
        botA: {
          energy: f.resources.botA.energy,
          heat: f.resources.botA.heat,
          coreHp: f.resources.botA.coreHp,
          isOverheated: f.resources.botA.isOverheated,
        },
        botB: {
          energy: f.resources.botB.energy,
          heat: f.resources.botB.heat,
          coreHp: f.resources.botB.coreHp,
          isOverheated: f.resources.botB.isOverheated,
        },
      },
      events: f.events || [],
    }));

    const canonicalChunk = stringifyCanonical(sanitizedFrames);
    const chunkHash = sha256(canonicalChunk);

    chunks.push({
      chunkIndex: chunkIdx++,
      startTick,
      endTick,
      frames: sanitizedFrames,
      chunkHash,
    });
  }

  // Compute overall publicReplayHash over all chunk hashes + manifest
  const summaryPayload = stringifyCanonical({
    manifest,
    chunkHashes: chunks.map(c => c.chunkHash),
    totalTicks: totalFrames,
    outcome,
  });
  const publicReplayHash = sha256(summaryPayload);

  return {
    manifest,
    totalTicks: totalFrames,
    chunkCount: chunks.length,
    chunks,
    publicReplayHash,
    outcome,
  };
}

/**
 * Seeks to an exact tick in the replay via fast chunk indexing
 */
export function seekReplayTick(replay: MatchReplay, targetTick: number): ReplayFrame | null {
  if (targetTick < 0 || targetTick >= replay.totalTicks) {
    return null;
  }
  const chunkIndex = Math.floor(targetTick / TICKS_PER_CHUNK);
  const chunk = replay.chunks[chunkIndex];
  if (!chunk) return null;

  const frameOffset = targetTick - chunk.startTick;
  return chunk.frames[frameOffset] || null;
}

/**
 * Validates integrity of all chunks and hashes in a MatchReplay
 */
export function verifyReplayIntegrity(replay: MatchReplay): { isValid: boolean; error?: string } {
  if (!replay.chunks || replay.chunks.length === 0) {
    return { isValid: false, error: 'Replay contains no chunks' };
  }

  // Verify each chunk
  for (let i = 0; i < replay.chunks.length; i++) {
    const chunk = replay.chunks[i];
    if (chunk.chunkIndex !== i) {
      return { isValid: false, error: `Invalid chunkIndex sequence at chunk ${i}` };
    }
    const canonical = stringifyCanonical(chunk.frames);
    const expectedHash = sha256(canonical);
    if (chunk.chunkHash !== expectedHash) {
      return { isValid: false, error: `Chunk hash mismatch at chunk ${i}` };
    }
  }

  // Verify publicReplayHash
  const summaryPayload = stringifyCanonical({
    manifest: replay.manifest,
    chunkHashes: replay.chunks.map(c => c.chunkHash),
    totalTicks: replay.totalTicks,
    outcome: replay.outcome,
  });
  const expectedReplayHash = sha256(summaryPayload);
  if (replay.publicReplayHash !== expectedReplayHash) {
    return { isValid: false, error: 'Overall publicReplayHash mismatch' };
  }

  return { isValid: true };
}
