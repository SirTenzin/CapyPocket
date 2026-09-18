export function isCapyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'capy.ai';
  } catch { return false; }
}

export function permittedNavigation(value: string): 'web' | 'external' | 'blocked' {
  if (value === 'about:blank') return 'web';
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return 'web';
    if (url.protocol === 'mailto:' || url.protocol === 'tel:') return 'external';
  } catch {}
  return 'blocked';
}

export function parseColors(raw: string): { top: string; bottom: string; lightText: boolean; edgeToEdge: boolean } | null {
  if (raw.length > 512) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.type !== 'capy-pocket-colors' || !/^#[0-9a-f]{6}$/i.test(value.top) || !/^#[0-9a-f]{6}$/i.test(value.bottom)) return null;
    const rgb = [1, 3, 5].map((i) => parseInt(value.top.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return { top: value.top, bottom: value.bottom, lightText: rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 < 0.179, edgeToEdge: value.edgeToEdge === true };
  } catch { return null; }
}
