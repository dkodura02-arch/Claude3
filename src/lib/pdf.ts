import { parseRecipeText, type ImportedRecipe } from './importer';

export interface TextItem {
  str: string;
  /** pdf.js transform matrix; [4] = x, [5] = y (from the bottom) */
  transform: number[];
  height?: number;
  hasEOL?: boolean;
}

/**
 * Rebuild readable lines from pdf.js text items: items on the same baseline form a line,
 * a noticeably larger gap between lines becomes an empty line (paragraph break).
 */
export function itemsToText(pages: TextItem[][]): string {
  const out: string[] = [];
  for (const items of pages) {
    const lines: { y: number; x: number; parts: { x: number; s: string }[]; h: number }[] = [];
    for (const it of items) {
      if (!it.str && !it.hasEOL) continue;
      const x = it.transform[4];
      const y = it.transform[5];
      const h = it.height || Math.abs(it.transform[3]) || 10;
      let line = lines.find((l) => Math.abs(l.y - y) < Math.max(2, h * 0.4));
      if (!line) {
        line = { y, x, parts: [], h };
        lines.push(line);
      }
      if (it.str) line.parts.push({ x, s: it.str });
      line.h = Math.max(line.h, h);
    }
    lines.sort((a, b) => b.y - a.y);
    const gaps = lines.slice(1).map((l, i) => lines[i].y - l.y);
    const typical = median(gaps.filter((g) => g > 0)) || 12;
    lines.forEach((l, i) => {
      const text = l.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.s)
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (i > 0 && lines[i - 1].y - l.y > typical * 1.5) out.push('');
      if (text) out.push(text);
    });
    out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const ING_HEADING = /^zutaten\b/i;

/** A PDF can hold several recipes (cookbook export) – split before each title + "Zutaten". */
export function splitRecipes(text: string): ImportedRecipe[] {
  const lines = text.split('\n');
  const starts: number[] = [];
  lines.forEach((l, i) => {
    if (!ING_HEADING.test(l.trim())) return;
    // title = closest non-empty line above the ingredient heading
    let t = i - 1;
    while (t >= 0 && !lines[t].trim()) t--;
    if (t >= 0) starts.push(t);
  });
  if (starts.length <= 1) return [parseRecipeText(starts.length ? lines.slice(starts[0]).join('\n') : text)];
  return starts.map((s, k) => parseRecipeText(lines.slice(s, starts[k + 1] ?? lines.length).join('\n')));
}

/** Read a PDF file in the browser (pdf.js is loaded only when needed). */
export async function pdfToText(file: Blob): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: TextItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push(content.items.filter((i): i is TextItem & typeof i => 'str' in i) as TextItem[]);
  }
  await doc.destroy();
  return itemsToText(pages);
}

export async function recipesFromPdf(file: Blob): Promise<ImportedRecipe[]> {
  const text = await pdfToText(file);
  if (!text.trim()) throw new Error('Im PDF wurde kein Text gefunden (eingescannte Bilder können nicht gelesen werden).');
  return splitRecipes(text).filter((r) => r.ingredients.length > 0 || r.steps.length > 0);
}
