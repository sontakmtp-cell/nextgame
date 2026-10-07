import { describe, expect, it } from 'vitest';
import { presentationUrl, readPresentationMode } from '../apps/web/src/presentation.js';

describe('U3D-00 presentation preference', () => {
  it('defaults to 2d and only accepts the explicit 3d request', () => {
    for (const query of ['', '?presentation=invalid', '?presentation=3D', '?presentation=2d']) {
      expect(readPresentationMode(`https://example.test/${query}`)).toBe('2d');
    }
    expect(readPresentationMode('https://example.test/?presentation=3d')).toBe('3d');
  });
  it('retains existing route, other parameters and fragment when switching', () => {
    const href = 'https://example.test/workshop?seed=17&presentation=3d#module';
    expect(presentationUrl(href, '2d')).toBe('https://example.test/workshop?seed=17&presentation=2d#module');
    expect(readPresentationMode(presentationUrl(href, '2d'))).toBe('2d');
  });
});
