import { BotDefinition, ModulePlacement } from './types.js';
import { sha256 } from './sha256.js';

/**
 * Parser that strictly rejects duplicate keys in JSON objects,
 * as well as prototype poison keys (__proto__, constructor, prototype).
 */
export function parseJsonRejectDuplicates<T = any>(jsonStr: string): T {
  let index = 0;
  const length = jsonStr.length;

  function skipWhitespace() {
    while (index < length) {
      const c = jsonStr.charCodeAt(index);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) {
        index++;
      } else {
        break;
      }
    }
  }

  function parseString(): string {
    if (jsonStr[index] !== '"') {
      throw new Error(`Expected '"' at offset ${index}`);
    }
    index++;
    let result = '';
    while (index < length) {
      const char = jsonStr[index];
      if (char === '"') {
        index++;
        return result;
      }
      if (char === '\\') {
        index++;
        if (index >= length) throw new Error('Unterminated string escape');
        const esc = jsonStr[index];
        index++;
        switch (esc) {
          case '"': result += '"'; break;
          case '\\': result += '\\'; break;
          case '/': result += '/'; break;
          case 'b': result += '\b'; break;
          case 'f': result += '\f'; break;
          case 'n': result += '\n'; break;
          case 'r': result += '\r'; break;
          case 't': result += '\t'; break;
          case 'u': {
            const hex = jsonStr.slice(index, index + 4);
            if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) {
              throw new Error(`Invalid unicode escape at offset ${index}`);
            }
            result += String.fromCharCode(parseInt(hex, 16));
            index += 4;
            break;
          }
          default:
            throw new Error(`Invalid escape character \\${esc} at offset ${index}`);
        }
      } else {
        result += char;
        index++;
      }
    }
    throw new Error('Unterminated string at EOF');
  }

  function parseObject(): Record<string, any> {
    index++; // skip '{'
    skipWhitespace();
    const obj: Record<string, any> = {};
    const seenKeys = new Set<string>();

    if (index < length && jsonStr[index] === '}') {
      index++;
      return obj;
    }

    while (index < length) {
      skipWhitespace();
      if (jsonStr[index] !== '"') {
        throw new Error(`Expected string property key at offset ${index}`);
      }
      const key = parseString();

      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error(`Forbidden poison property key: "${key}"`);
      }
      if (seenKeys.has(key)) {
        throw new Error(`Duplicate key detected in JSON: "${key}"`);
      }
      seenKeys.add(key);

      skipWhitespace();
      if (jsonStr[index] !== ':') {
        throw new Error(`Expected ':' after key "${key}" at offset ${index}`);
      }
      index++; // skip ':'

      skipWhitespace();
      const val = parseValue();
      obj[key] = val;

      skipWhitespace();
      if (jsonStr[index] === '}') {
        index++;
        return obj;
      }
      if (jsonStr[index] === ',') {
        index++;
        continue;
      }
      throw new Error(`Expected ',' or '}' in object at offset ${index}`);
    }
    throw new Error('Unterminated object at EOF');
  }

  function parseArray(): any[] {
    index++; // skip '['
    skipWhitespace();
    const arr: any[] = [];

    if (index < length && jsonStr[index] === ']') {
      index++;
      return arr;
    }

    while (index < length) {
      skipWhitespace();
      const val = parseValue();
      arr.push(val);

      skipWhitespace();
      if (jsonStr[index] === ']') {
        index++;
        return arr;
      }
      if (jsonStr[index] === ',') {
        index++;
        continue;
      }
      throw new Error(`Expected ',' or ']' in array at offset ${index}`);
    }
    throw new Error('Unterminated array at EOF');
  }

  function parseValue(): any {
    skipWhitespace();
    if (index >= length) throw new Error('Unexpected EOF');
    const c = jsonStr[index];

    if (c === '{') return parseObject();
    if (c === '[') return parseArray();
    if (c === '"') return parseString();
    if (c === 't' && jsonStr.startsWith('true', index)) {
      index += 4;
      return true;
    }
    if (c === 'f' && jsonStr.startsWith('false', index)) {
      index += 5;
      return false;
    }
    if (c === 'n' && jsonStr.startsWith('null', index)) {
      index += 4;
      return null;
    }

    // Number
    const start = index;
    if (c === '-') index++;
    while (index < length && /[0-9.eE+-]/.test(jsonStr[index])) {
      index++;
    }
    const numStr = jsonStr.slice(start, index);
    const num = Number(numStr);
    if (isNaN(num)) {
      throw new Error(`Invalid number literal "${numStr}" at offset ${start}`);
    }
    return num;
  }

  skipWhitespace();
  const result = parseValue();
  skipWhitespace();
  if (index < length) {
    throw new Error(`Unexpected trailing characters at offset ${index}`);
  }
  return result;
}

/**
 * Canonical JSON serializer:
 * - Sorts object keys lexicographically (ASCII order)
 * - Normalizes Unicode strings to NFC
 * - Serializes numbers as exact decimal without scientific notation or floats
 * - Strict type handling: disallows undefined, NaN, Infinity, functions
 * - No extra whitespace
 */
export function stringifyCanonical(value: any): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.floor(value) !== value) {
      throw new Error(`Canonical encoder: invalid non-integer number ${value}`);
    }
    return value.toString(10);
  }
  if (typeof value === 'string') {
    // NFC normalization
    const nfc = value.normalize('NFC');
    return JSON.stringify(nfc);
  }
  if (Array.isArray(value)) {
    const elements = value.map(el => stringifyCanonical(el));
    return `[${elements.join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter(k => k !== '__proto__' && k !== 'constructor' && k !== 'prototype');
    keys.sort(); // Lexicographical sort

    const entries = keys.map(k => {
      const v = value[k];
      if (v === undefined) return null;
      return `${JSON.stringify(k)}:${stringifyCanonical(v)}`;
    }).filter(Boolean);

    return `{${entries.join(',')}}`;
  }
  throw new Error(`Canonical encoder: unsupported data type ${typeof value}`);
}

/**
 * Geometry Ordinal Comparison:
 * Modules sorted canonically by:
 * 1. cell.y ascending
 * 2. cell.x ascending
 * 3. catalogId ascending
 * 4. orientation ascending
 */
export function compareModuleGeometry(a: ModulePlacement, b: ModulePlacement): number {
  if (a.cell.y !== b.cell.y) return a.cell.y - b.cell.y;
  if (a.cell.x !== b.cell.x) return a.cell.x - b.cell.x;
  if (a.catalogId !== b.catalogId) return a.catalogId.localeCompare(b.catalogId);
  return a.orientation - b.orientation;
}

/**
 * Builds canonical gameplay payload from BotDefinition:
 * 1. Sorts modules canonically
 * 2. Maps module identifiers to deterministic ordinal keys (e.g. "mod:0", "mod:1")
 * 3. Canonicalizes Brain references to match those ordinals
 * 4. Stringifies canonically
 * 5. Calculates packageHash via pure SHA-256
 */
export function createCanonicalGameplay(
  bot: BotDefinition,
  compilerDigest: string = 'sha256:alpha0_compiler_digest',
  catalogDigest: string = 'sha256:alpha0_catalog_digest'
): { canonicalGameplay: string; packageHash: string; idMap: Record<string, string> } {
  // Clone modules and sort canonically
  const sortedModules = [...bot.body.modules].sort(compareModuleGeometry);

  // Mapping from original ID to canonical ordinal ID
  const idMap: Record<string, string> = {};
  sortedModules.forEach((m, idx) => {
    idMap[m.id] = `mod:${idx}`;
  });

  // Re-map module IDs in modules array
  const normalizedModules = sortedModules.map(m => ({
    id: idMap[m.id],
    catalogId: m.catalogId,
    cell: { x: m.cell.x, y: m.cell.y },
    orientation: m.orientation,
  }));

  // Re-map Brain module intent references
  const normalizedBrain = {
    abiVersion: bot.brain.abiVersion,
    initialState: bot.brain.initialState,
    variables: [...bot.brain.variables].sort((a, b) => a.id.localeCompare(b.id)),
    skills: bot.brain.skills || [],
    states: bot.brain.states.map(state => ({
      id: state.id,
      rules: state.rules.map(rule => ({
        id: rule.id,
        when: rule.when,
        set: rule.set,
        intent: {
          thrust: rule.intent.thrust,
          turn: rule.intent.turn,
          modules: rule.intent.modules.map(mi => ({
            moduleId: idMap[mi.moduleId] || mi.moduleId,
            action: mi.action,
            aimOffset: mi.aimOffset,
            priority: mi.priority,
          })),
        },
        nextState: rule.nextState,
      })),
    })),
  };

  const canonicalObject = {
    schemaVersion: bot.schemaVersion,
    body: {
      grid: bot.body.grid,
      modules: normalizedModules,
    },
    brain: normalizedBrain,
    compilerDigest,
    catalogDigest,
  };

  const canonicalGameplay = stringifyCanonical(canonicalObject);
  const packageHash = sha256(canonicalGameplay);

  return {
    canonicalGameplay,
    packageHash,
    idMap,
  };
}
