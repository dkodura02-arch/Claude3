import { parseIngredient } from './ingredients';
import type { Batch, Carb, Effort, Ingredient } from './types';

export interface ImportedRecipe {
  title: string;
  imageUrl?: string;
  sourceUrl?: string;
  servings?: number;
  time?: number;
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type JsonObj = { [k: string]: Json };

const isObj = (x: Json | undefined): x is JsonObj => !!x && typeof x === 'object' && !Array.isArray(x);

function decodeEntities(s: string): string {
  if (!s.includes('&')) return s;
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${s}`, 'text/html');
  return doc.body.textContent ?? s;
}

function cleanText(s: string): string {
  return decodeEntities(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function asString(x: Json | undefined): string | undefined {
  if (typeof x === 'string') return x;
  if (typeof x === 'number') return String(x);
  if (Array.isArray(x)) return asString(x[0]);
  if (isObj(x)) return asString(x['@value'] ?? x.text ?? x.name);
  return undefined;
}

function hasType(o: JsonObj, type: string): boolean {
  const t = o['@type'];
  if (typeof t === 'string') return t === type || t.endsWith(`/${type}`);
  if (Array.isArray(t)) return t.some((x) => typeof x === 'string' && (x === type || x.endsWith(`/${type}`)));
  return false;
}

function findRecipe(node: Json, depth = 0): JsonObj | undefined {
  if (depth > 8 || !node) return undefined;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n, depth + 1);
      if (r) return r;
    }
    return undefined;
  }
  if (!isObj(node)) return undefined;
  if (hasType(node, 'Recipe')) return node;
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    const r = findRecipe(node[key], depth + 1);
    if (r) return r;
  }
  return undefined;
}

function imageUrl(img: Json | undefined): string | undefined {
  if (!img) return undefined;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) {
    // prefer the largest ImageObject if sizes are given, otherwise the first
    const urls = img.map((i) => ({ url: imageUrl(i), w: isObj(i) ? Number(i.width) || 0 : 0 }));
    urls.sort((a, b) => b.w - a.w);
    return urls.find((u) => u.url)?.url;
  }
  if (isObj(img)) return asString(img.url ?? img.contentUrl ?? img['@id']);
  return undefined;
}

function instructions(x: Json | undefined): string[] {
  if (!x) return [];
  if (typeof x === 'string') {
    return cleanText(x)
      .split(/\n+|(?<=\.)\s+(?=\d+\.\s)/)
      .map((s) => s.replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean);
  }
  if (Array.isArray(x)) return x.flatMap(instructions);
  if (isObj(x)) {
    if (hasType(x, 'HowToSection')) {
      const name = asString(x.name);
      const items = instructions(x.itemListElement);
      return name && items.length ? [`${cleanText(name)}:`, ...items] : items;
    }
    const t = asString(x.text) ?? asString(x.name);
    return t ? instructions(t) : [];
  }
  return [];
}

/** "PT1H30M" -> 90 */
export function parseDuration(x: Json | undefined): number | undefined {
  const s = asString(x);
  if (!s) return undefined;
  const m = s.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return undefined;
  const min = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return min > 0 ? min : undefined;
}

function servings(x: Json | undefined): number | undefined {
  const s = Array.isArray(x) ? x.map((v) => asString(v)).find((v) => v && /\d/.test(v)) : asString(x);
  const m = s?.match(/\d+/);
  return m ? Number(m[0]) : undefined;
}

function fromJsonLd(r: JsonObj, url?: string): ImportedRecipe {
  const ingList = Array.isArray(r.recipeIngredient)
    ? r.recipeIngredient
    : Array.isArray(r.ingredients)
      ? r.ingredients
      : [];
  const ingredients = ingList
    .map((i) => asString(i))
    .filter((s): s is string => !!s)
    .map((s) => cleanText(s))
    .filter(Boolean)
    .map(parseIngredient);
  const time =
    parseDuration(r.totalTime) ??
    (() => {
      const a = parseDuration(r.prepTime) ?? 0;
      const b = parseDuration(r.cookTime) ?? 0;
      return a + b || undefined;
    })();
  return {
    title: cleanText(asString(r.name) ?? '') || 'Rezept',
    imageUrl: absolutize(imageUrl(r.image), url),
    sourceUrl: url,
    servings: servings(r.recipeYield),
    time,
    ingredients,
    steps: instructions(r.recipeInstructions),
    notes: asString(r.description) ? cleanText(asString(r.description)!) : undefined,
  };
}

function absolutize(u: string | undefined, base?: string): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u, base).href;
  } catch {
    return u;
  }
}

function parseJsonLoose(text: string): Json | undefined {
  const t = text
    .replace(/^\s*<!\[CDATA\[/, '')
    .replace(/\]\]>\s*$/, '')
    .trim();
  try {
    return JSON.parse(t) as Json;
  } catch {
    // some sites put raw newlines/tabs inside strings
    try {
      return JSON.parse(t.replace(/[\n\r\t]+/g, ' ')) as Json;
    } catch {
      return undefined;
    }
  }
}

/** Extract a recipe from a web page (schema.org JSON-LD, microdata, then Open Graph). */
export function parseRecipeHtml(html: string, url?: string): ImportedRecipe | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const s of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    const json = parseJsonLoose(s.textContent ?? '');
    const r = json && findRecipe(json);
    if (r) return fromJsonLd(r, url);
  }

  // Microdata
  const scope = doc.querySelector('[itemtype*="schema.org/Recipe"]');
  if (scope) {
    const prop = (name: string) => Array.from(scope.querySelectorAll(`[itemprop="${name}"]`));
    const val = (el: Element) =>
      el.getAttribute('content') ?? el.getAttribute('src') ?? el.getAttribute('href') ?? el.textContent ?? '';
    const ings = [...prop('recipeIngredient'), ...prop('ingredients')].map((e) => cleanText(val(e))).filter(Boolean);
    if (ings.length) {
      return {
        title: cleanText(val(prop('name')[0] ?? doc.createElement('x'))) || doc.title,
        imageUrl: absolutize(prop('image')[0] ? val(prop('image')[0]) : undefined, url),
        sourceUrl: url,
        servings: servings(prop('recipeYield')[0] ? val(prop('recipeYield')[0]) : undefined),
        time: parseDuration(prop('totalTime')[0] ? val(prop('totalTime')[0]) : undefined),
        ingredients: ings.map(parseIngredient),
        steps: prop('recipeInstructions').flatMap((e) => instructions(e.innerHTML)),
      };
    }
  }

  // Open Graph – at least title and picture, the rest is entered by hand
  const meta = (p: string) =>
    doc.querySelector(`meta[property="${p}"], meta[name="${p}"]`)?.getAttribute('content') ?? undefined;
  const title = meta('og:title') ?? doc.title;
  if (!title) return null;
  return {
    title: cleanText(title),
    imageUrl: absolutize(meta('og:image'), url),
    sourceUrl: url,
    ingredients: [],
    steps: [],
    notes: meta('og:description') ? cleanText(meta('og:description')!) : undefined,
  };
}

const ING_HEAD = /^(zutaten|einkaufsliste|du brauchst|ihr braucht|für \d+(?:[.,]\d+)? (portionen|personen))\b/i;
const STEP_HEAD = /^(zubereitung|anleitung|so geht'?s|schritte|arbeitsschritte|zubereitungsschritte|methode)\b/i;
const NOTE_HEAD = /^(tipps?|notizen?|hinweis)\b/i;
const LOOKS_LIKE_ING = /^([\d½¼¾⅓⅔]|etwas\b|n\.\s?b\.|eine?\b|prise\b|salz\b|pfeffer\b)/i;

/** Split pasted free text into title / ingredients / steps. */
export function parseRecipeText(text: string): ImportedRecipe {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[\s•\-*–·▪]+/, '').trim());
  const nonEmpty = lines.filter(Boolean);
  const title = nonEmpty[0] ?? 'Neues Rezept';
  const urlMatch = text.match(/https?:\/\/\S+/);

  const ing: string[] = [];
  const steps: string[] = [];
  const notes: string[] = [];
  let section: 'none' | 'ing' | 'steps' | 'notes' = 'none';
  let servingsN: number | undefined;
  const hasHeadings = nonEmpty.some((l) => ING_HEAD.test(l) || STEP_HEAD.test(l));

  for (const line of nonEmpty.slice(1)) {
    const portion = line.match(/(\d+)(?:[.,]\d+)?\s*(portionen|personen|pers\.)/i);
    if (portion && !servingsN) servingsN = Number(portion[1]);
    if (ING_HEAD.test(line)) {
      section = 'ing';
      continue;
    }
    if (STEP_HEAD.test(line)) {
      section = 'steps';
      continue;
    }
    if (NOTE_HEAD.test(line)) {
      section = 'notes';
      continue;
    }
    if (urlMatch && line.includes(urlMatch[0])) continue;
    if (section === 'ing') ing.push(line);
    else if (section === 'steps') steps.push(line.replace(/^\d+[.)]\s*/, ''));
    else if (section === 'notes') notes.push(line);
    else if (!hasHeadings) {
      // no headings: short lines with amounts are ingredients, the rest are steps
      if (LOOKS_LIKE_ING.test(line) && line.length < 80 && steps.length === 0) ing.push(line);
      else steps.push(line.replace(/^\d+[.)]\s*/, ''));
    } else if (portion) {
      // "Für 4 Portionen" before the ingredient heading
    } else notes.push(line);
  }

  return {
    title: title.replace(/^rezept:\s*/i, ''),
    sourceUrl: urlMatch?.[0],
    servings: servingsN,
    ingredients: ing.map(parseIngredient),
    steps,
    notes: notes.length ? notes.join('\n') : undefined,
  };
}

/** Guess the carb source from the ingredient list (only a suggestion for the form). */
export function guessCarb(ingredients: Ingredient[]): Carb {
  const names = ingredients.map((i) => i.name.toLowerCase());
  const has = (...words: string[]) => names.some((n) => words.some((w) => n.includes(w)));
  if (has('kartoffel', 'drillinge') && !has('süßkartoffel')) return 'kartoffeln';
  if (has('nudel', 'spaghetti', 'penne', 'pasta', 'fusilli', 'tagliatelle', 'linguine', 'lasagne', 'rigatoni', 'farfalle', 'orzo', 'tortellini', 'ravioli', 'maccheroni', 'gnocchi', 'spätzle'))
    return 'nudeln';
  if (names.some((n) => /(^|[^pk])reis/.test(n)) || has('risotto', 'basmati')) return 'reis';
  if (has('bulgur')) return 'bulgur';
  if (has('couscous')) return 'couscous';
  if (has('quinoa')) return 'quinoa';
  if (has('linsen')) return 'linsen';
  return 'ohne';
}

export function guessEffort(time?: number): Effort {
  if (!time) return 'mittel';
  if (time <= 30) return 'leicht';
  if (time <= 75) return 'mittel';
  return 'aufwendig';
}

export function guessBatch(servingsN?: number): Batch {
  return servingsN && servingsN >= 4 ? 'big' : 'small';
}
