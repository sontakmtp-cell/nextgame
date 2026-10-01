import { describe, it, expect } from 'vitest';
import { validateBotDefinition } from '../src/index.js';
import {
  VALID_MANTIS,
  VALID_BASTION,
  VALID_KESTREL,
  INVALID_BOT_NO_CORE,
  INVALID_BOT_MULTIPLE_CORES,
  INVALID_BOT_OVERLAP,
  INVALID_BOT_DISCONNECTED,
  INVALID_BOT_BUDGET_EXCEEDED,
  INVALID_BOT_TOO_MANY_MODULES,
  INVALID_BOT_RADIUS_EXCEEDED,
} from '../../testkit/src/index.js';
import { REFERENCE_BOTS } from '../../content/src/index.js';

describe('Contracts - Validation Suite (Positive & Negative Vectors)', () => {
  it('validates all 6 reference bots successfully', () => {
    for (const bot of Object.values(REFERENCE_BOTS)) {
      const report = validateBotDefinition(bot);
      expect(report.isValid, `Bot ${bot.name} should be valid`).toBe(true);
      expect(report.errors.filter(e => e.type === 'error')).toHaveLength(0);
      expect(report.coreFound).toBe(true);
      expect(report.isConnected).toBe(true);
      expect(report.totalCost).toBeLessThanOrEqual(100);
      expect(report.totalModules).toBeLessThanOrEqual(24);
      expect(report.boundingRadiusMilli).toBeLessThanOrEqual(6500);
    }
  });

  it('rejects bot missing Core', () => {
    const report = validateBotDefinition(INVALID_BOT_NO_CORE);
    expect(report.isValid).toBe(false);
    expect(report.errors.some(e => e.code === 'CORE_MISSING')).toBe(true);
  });

  it('rejects bot with multiple Cores', () => {
    const report = validateBotDefinition(INVALID_BOT_MULTIPLE_CORES);
    expect(report.isValid).toBe(false);
    expect(report.errors.some(e => e.code === 'CORE_MULTIPLE')).toBe(true);
  });

  it('rejects bot with module cell overlap', () => {
    const report = validateBotDefinition(INVALID_BOT_OVERLAP);
    expect(report.isValid).toBe(false);
    expect(report.errors.some(e => e.code === 'CELL_OVERLAP')).toBe(true);
  });

  it('rejects bot with disconnected module', () => {
    const report = validateBotDefinition(INVALID_BOT_DISCONNECTED);
    expect(report.isValid).toBe(false);
    expect(report.errors.some(e => e.code === 'DISCONNECTED_MODULE')).toBe(true);
  });

  it('rejects bot exceeding 100 points budget', () => {
    const report = validateBotDefinition(INVALID_BOT_BUDGET_EXCEEDED);
    expect(report.isValid).toBe(false);
    expect(report.errors.some(e => e.code === 'BUDGET_EXCEEDED')).toBe(true);
  });

  it('rejects bot exceeding 24 module cap', () => {
    const report = validateBotDefinition(INVALID_BOT_TOO_MANY_MODULES);
    expect(report.isValid).toBe(false);
    expect(report.errors.some(e => e.code === 'MODULE_COUNT_EXCEEDED')).toBe(true);
  });

  it('rejects bot exceeding 6500 bounding radius from Core center', () => {
    const report = validateBotDefinition(INVALID_BOT_RADIUS_EXCEEDED);
    expect(report.isValid).toBe(false);
    expect(report.errors.some(e => e.code === 'BOUNDING_RADIUS_EXCEEDED')).toBe(true);
  });

  it('rejects bot exceeding weapon catalog cap (> 3)', () => {
    const bot = JSON.parse(JSON.stringify(VALID_MANTIS));
    bot.body.modules.push(
      { id: 'w_extra1', catalogId: 'blade', cell: { x: 4, y: 7 }, orientation: 0 },
      { id: 'w_extra2', catalogId: 'blade', cell: { x: 7, y: 7 }, orientation: 0 }
    );
    const report = validateBotDefinition(bot);
    expect(report.isValid).toBe(false);
    expect(report.errors.some(e => e.code === 'TOO_MANY_WEAPONS')).toBe(true);
  });

  it('rejects bot exceeding shield catalog cap (> 1)', () => {
    const bot = JSON.parse(JSON.stringify(VALID_BASTION));
    bot.body.modules.push({
      id: 'shield_extra',
      catalogId: 'shield',
      cell: { x: 4, y: 7 },
      orientation: 0,
    });
    const report = validateBotDefinition(bot);
    expect(report.isValid).toBe(false);
    expect(report.errors.some(e => e.code === 'TOO_MANY_SHIELDS')).toBe(true);
  });
});
