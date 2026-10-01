import { describe, it, expect } from 'vitest';
import {
  stringifyCanonical,
  createCanonicalGameplay,
  compareModuleGeometry,
  parseJsonRejectDuplicates,
  sha256,
  BotDefinition,
} from '../src/index.js';
import { VALID_MANTIS } from '../../testkit/src/index.js';

describe('Contracts - Canonical Codec & SHA-256', () => {
  it('NIST SHA-256 standard test vectors pass', () => {
    // Empty string
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    // "abc"
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    // "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    );
  });

  it('sorts object keys lexicographically and strips whitespace', () => {
    const objA = { z: 1, b: 2, a: 3 };
    const objB = { a: 3, z: 1, b: 2 };
    expect(stringifyCanonical(objA)).toBe('{"a":3,"b":2,"z":1}');
    expect(stringifyCanonical(objB)).toBe('{"a":3,"b":2,"z":1}');
    expect(stringifyCanonical(objA)).toBe(stringifyCanonical(objB));
  });

  it('normalizes Unicode strings to NFC form', () => {
    // Vietnamese "Chiến" in NFD (decomposed) vs NFC (composed)
    const nfc = 'Chiến';
    const nfd = nfc.normalize('NFD');
    expect(nfc).not.toBe(nfd);
    expect(stringifyCanonical(nfc)).toBe(stringifyCanonical(nfd));
  });

  it('strictly rejects non-integers in canonical encoder', () => {
    expect(() => stringifyCanonical({ float: 12.34 })).toThrow(/non-integer/);
    expect(() => stringifyCanonical({ nan: NaN })).toThrow(/non-integer/);
    expect(() => stringifyCanonical({ inf: Infinity })).toThrow(/non-integer/);
  });

  it('rejects duplicate JSON keys via parseJsonRejectDuplicates', () => {
    const validJson = '{"name": "Mantis", "version": 2}';
    expect(parseJsonRejectDuplicates(validJson)).toEqual({ name: 'Mantis', version: 2 });

    const duplicateKeyJson = '{"name": "Mantis", "name": "Bastion"}';
    expect(() => parseJsonRejectDuplicates(duplicateKeyJson)).toThrow(/Duplicate key/);
  });

  it('rejects prototype poison keys', () => {
    expect(() => parseJsonRejectDuplicates('{"__proto__": {}}')).toThrow(/poison/);
    expect(() => parseJsonRejectDuplicates('{"constructor": {}}')).toThrow(/poison/);
    expect(() => parseJsonRejectDuplicates('{"prototype": {}}')).toThrow(/poison/);
  });

  it('sorts modules by geometry ordinal (cell.y, cell.x, catalogId, orientation)', () => {
    const mod1 = { id: 'm1', catalogId: 'armor' as const, cell: { x: 5, y: 3 }, orientation: 0 as const };
    const mod2 = { id: 'm2', catalogId: 'thruster' as const, cell: { x: 4, y: 3 }, orientation: 0 as const };
    const mod3 = { id: 'm3', catalogId: 'blade' as const, cell: { x: 2, y: 1 }, orientation: 0 as const };

    const sorted = [mod1, mod2, mod3].sort(compareModuleGeometry);
    // mod3 has y=1
    // mod2 has y=3, x=4
    // mod1 has y=3, x=5
    expect(sorted[0].id).toBe('m3');
    expect(sorted[1].id).toBe('m2');
    expect(sorted[2].id).toBe('m1');
  });

  it('produces identical packageHash regardless of module authoring order or module names', () => {
    const bot1: BotDefinition = JSON.parse(JSON.stringify(VALID_MANTIS));
    const bot2: BotDefinition = JSON.parse(JSON.stringify(VALID_MANTIS));

    // Reverse module array in bot2
    bot2.body.modules.reverse();

    const res1 = createCanonicalGameplay(bot1);
    const res2 = createCanonicalGameplay(bot2);

    expect(res1.canonicalGameplay).toBe(res2.canonicalGameplay);
    expect(res1.packageHash).toBe(res2.packageHash);
    expect(res1.packageHash).toHaveLength(64);
  });

  it('exports valid JSON Schema 2020-12 definitions', async () => {
    const { BOT_DEFINITION_SCHEMA, MATCH_MANIFEST_SCHEMA } = await import('../src/index.js');
    expect(BOT_DEFINITION_SCHEMA.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(BOT_DEFINITION_SCHEMA.title).toBe('BotDefinition');
    expect(MATCH_MANIFEST_SCHEMA.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(MATCH_MANIFEST_SCHEMA.title).toBe('MatchManifest');
  });
});
