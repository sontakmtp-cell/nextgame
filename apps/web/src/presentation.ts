import type { PresentationMode } from '@prompt-chien/renderer3d';

export function readPresentationMode(href: string): PresentationMode {
  return new URL(href).searchParams.get('presentation') === '3d' ? '3d' : '2d';
}

export function presentationUrl(href: string, mode: PresentationMode): string {
  const url = new URL(href);
  url.searchParams.set('presentation', mode);
  return url.href;
}
