/** Per-device preferences (not synced – each phone keeps its own). */
export type FontSize = 'normal' | 'gross' | 'sehr-gross';

const FONT_KEY = 'kochplaner-font';
export const DEFAULT_FONT: FontSize = 'gross';

export function getFontSize(): FontSize {
  try {
    const v = localStorage.getItem(FONT_KEY);
    if (v === 'normal' || v === 'gross' || v === 'sehr-gross') return v;
  } catch {
    // private mode etc.
  }
  return DEFAULT_FONT;
}

export function applyFontSize(size: FontSize = getFontSize()) {
  document.documentElement.dataset.font = size;
}

export function setFontSize(size: FontSize) {
  try {
    localStorage.setItem(FONT_KEY, size);
  } catch {
    // ignore
  }
  applyFontSize(size);
}
