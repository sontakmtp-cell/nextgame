export class ContractError extends Error {
  constructor(public code: string, public pointer: string, message = code) { super(message); }
}
const poison = new Set(['__proto__', 'constructor', 'prototype']);
/** Bounded JSON reader: rejects duplicates before they can be lost by JSON.parse. */
export function decodeJson(text: string): unknown {
  if (text.length > 262144 || new TextEncoder().encode(text).length > 262144) throw new ContractError('BYTE_CAP', '');
  let i = 0, nodes = 0;
  const numberToken=/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
  const space = () => { while (i < text.length && /[\t\n\r ]/.test(text[i]!)) i++; };
  const fail = (code: string, path: string): never => { throw new ContractError(code, path, `${code} at byte/char ${i}`); };
  const str = (path: string): string => {
    const start = i++;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i++] === '"') {
        try { return JSON.parse(text.slice(start, i)) as string; } catch { return fail('JSON_SYNTAX', path); }
      }
    }
    return fail('JSON_SYNTAX', path);
  };
  const read = (depth: number, path: string): unknown => {
    if (depth > 32) fail('NESTING_CAP', path);
    if (++nodes > 16384) fail('JSON_NODE_CAP', path);
    space();
    if (text[i] === '"') return str(path);
    if (text[i] === '{') {
      i++; space();
      const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      const keys = new Set<string>();
      if (text[i] === '}') { i++; return result; }
      for (;;) {
        if (text[i] !== '"') fail('JSON_SYNTAX', path);
        const key = str(path), child = `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
        if (poison.has(key)) fail('POISON_KEY', child);
        if (keys.has(key)) fail('DUPLICATE_KEY', child);
        keys.add(key); space();
        if (text[i++] !== ':') fail('JSON_SYNTAX', child);
        result[key] = read(depth + 1, child); space();
        const end = text[i++];
        if (end === '}') return result;
        if (end !== ',') fail('JSON_SYNTAX', path);
        space();
      }
    }
    if (text[i] === '[') {
      i++; space(); const result: unknown[] = [];
      if (text[i] === ']') { i++; return result; }
      for (;;) {
        result.push(read(depth + 1, `${path}/${result.length}`)); space();
        const end = text[i++];
        if (end === ']') return result;
        if (end !== ',') fail('JSON_SYNTAX', path);
      }
    }
    for (const [token, value] of [['true', true], ['false', false], ['null', null]] as const) {
      if (text.startsWith(token, i)) { i += token.length; return value; }
    }
    numberToken.lastIndex=i;
    const match = numberToken.exec(text);
    if (!match) return fail('JSON_SYNTAX', path);
    i += match[0].length;
    const number = Number(match[0]);
    if (!Number.isSafeInteger(number) || /[.eE]/.test(match[0])) fail('INTEGER_REQUIRED', path);
    return number;
  };
  const result = read(0, ''); space();
  if (i !== text.length) fail('JSON_SYNTAX', '');
  return result;
}
export function canonical(value: unknown): string {
  // Use the same bound/poison checks for in-memory callers and byte inputs.
  let nodes = 0;
  const encode = (item: unknown, depth: number): string => {
    if (++nodes > 16384 || depth > 32) throw new ContractError('CANONICAL_CAP', '');
    if (item === null || typeof item === 'boolean') return String(item);
    if (typeof item === 'number') {
      if (!Number.isSafeInteger(item)) throw new ContractError('INTEGER_REQUIRED', '');
      return String(item === 0 ? 0 : item);
    }
    if (typeof item === 'string') {
      if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(item)) throw new ContractError('INVALID_UNICODE', '');
      return JSON.stringify(item.normalize('NFC'));
    }
    if (Array.isArray(item)) return `[${item.map(x => encode(x, depth + 1)).join(',')}]`;
    if (typeof item === 'object') {
      const prototype=Object.getPrototypeOf(item);
      if(prototype!==null && prototype!==Object.prototype)throw new ContractError('CANONICAL_OBJECT','');
      const object = item as Record<string, unknown>;
      const keys=Object.keys(object).map(key=>({original:key,normalized:key.normalize('NFC')})).sort((a,b)=>a.normalized<b.normalized?-1:a.normalized>b.normalized?1:0);
      const normalized = new Set<string>();
      return `{${keys.map(({original:key,normalized:n}) => {
        if (poison.has(key) || normalized.has(n)) throw new ContractError('CANONICAL_KEY', '');
        normalized.add(n);
        return `${encode(n, depth + 1)}:${encode(object[key], depth + 1)}`;
      }).join(',')}}`;
    }
    throw new ContractError('CANONICAL_TYPE', '');
  };
  return encode(value, 0);
}
export async function sha256(bytes: string | Uint8Array): Promise<string> {
  const input = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  const result = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(input));
  return Array.from(new Uint8Array(result), b => b.toString(16).padStart(2, '0')).join('');
}
export async function digest(value: unknown): Promise<string> { return sha256(canonical(value)); }
