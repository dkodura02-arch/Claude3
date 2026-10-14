import type { Recipe } from './types';

export type ProduceKind = 'gemuese' | 'obst' | 'pilz';

export interface Produce {
  name: string;
  kind: ProduceKind;
  /** Months (1-12) with regional, fresh or stored produce in Germany */
  months: number[];
  /** Only really available in these months (e.g. Spargel). Out of season -> not suggested. */
  strict?: boolean;
  /** Lowercase substrings that identify the produce in an ingredient name */
  keys: string[];
  /** Substrings that rule a match out ("Kürbiskerne", "Tomatenmark") */
  exclude?: string[];
  emoji: string;
}

const range = (from: number, to: number): number[] => {
  const out: number[] = [];
  let m = from;
  for (;;) {
    out.push(m);
    if (m === to) break;
    m = (m % 12) + 1;
  }
  return out;
};

const PRESERVED = ['tk', 'tiefgekühlt', 'gefroren', 'dose', 'glas', 'getrocknet', 'konserve'];

/** Saisonkalender Deutschland (Freiland & Lagerware) */
export const PRODUCE: Produce[] = [
  // Gemüse – ausgeprägte Saison
  { name: 'Spargel', kind: 'gemuese', months: range(4, 6), strict: true, keys: ['spargel'], emoji: '🌱' },
  { name: 'Bärlauch', kind: 'gemuese', months: range(3, 5), strict: true, keys: ['bärlauch'], exclude: ['salz'], emoji: '🌿' },
  { name: 'Rhabarber', kind: 'gemuese', months: range(4, 6), strict: true, keys: ['rhabarber'], exclude: ['saft', 'kompott'], emoji: '🌱' },
  { name: 'Mairübchen', kind: 'gemuese', months: range(4, 6), strict: true, keys: ['mairübchen', 'mairübe'], emoji: '🥬' },
  { name: 'Kürbis', kind: 'gemuese', months: range(8, 1), strict: true, keys: ['kürbis', 'hokkaido', 'butternut'], exclude: ['kerne', 'kernöl', 'kern'], emoji: '🎃' },
  { name: 'Grünkohl', kind: 'gemuese', months: range(10, 2), strict: true, keys: ['grünkohl'], emoji: '🥬' },
  { name: 'Topinambur', kind: 'gemuese', months: range(10, 3), strict: true, keys: ['topinambur'], emoji: '🥔' },
  { name: 'Schwarzwurzel', kind: 'gemuese', months: range(10, 3), strict: true, keys: ['schwarzwurzel'], emoji: '🥕' },
  // Gemüse – Sommer
  { name: 'Zucchini', kind: 'gemuese', months: range(6, 9), keys: ['zucchini', 'zucchetti'], emoji: '🥒' },
  { name: 'Aubergine', kind: 'gemuese', months: range(7, 9), keys: ['aubergine'], emoji: '🍆' },
  { name: 'Paprika', kind: 'gemuese', months: range(7, 10), keys: ['paprika'], exclude: ['pulver', 'edelsüß', 'rosenscharf', 'geräuchert', 'mark', ...PRESERVED], emoji: '🫑' },
  { name: 'Tomaten', kind: 'gemuese', months: range(7, 10), keys: ['tomate', 'tomaten'], exclude: ['mark', 'passiert', 'gehackt', 'ketchup', 'polpa', 'pizzatomate', 'sauce', 'soße', 'sugo', 'stückig', ...PRESERVED], emoji: '🍅' },
  { name: 'Gurke', kind: 'gemuese', months: range(6, 9), keys: ['gurke'], exclude: ['gewürzgurke', 'essiggurke', 'cornichon', 'saure'], emoji: '🥒' },
  { name: 'Grüne Bohnen', kind: 'gemuese', months: range(7, 9), keys: ['grüne bohnen', 'buschbohnen', 'stangenbohnen', 'brechbohnen', 'prinzessbohnen', 'keniabohnen'], exclude: PRESERVED, emoji: '🫛' },
  { name: 'Zuckerschoten', kind: 'gemuese', months: range(5, 8), keys: ['zuckerschote', 'zuckererbse'], exclude: PRESERVED, emoji: '🫛' },
  { name: 'Blumenkohl', kind: 'gemuese', months: range(6, 10), keys: ['blumenkohl'], exclude: PRESERVED, emoji: '🥦' },
  { name: 'Brokkoli', kind: 'gemuese', months: range(6, 10), keys: ['brokkoli', 'broccoli'], exclude: PRESERVED, emoji: '🥦' },
  { name: 'Romanesco', kind: 'gemuese', months: range(7, 10), keys: ['romanesco'], emoji: '🥦' },
  { name: 'Kohlrabi', kind: 'gemuese', months: range(5, 10), keys: ['kohlrabi'], emoji: '🥬' },
  { name: 'Mangold', kind: 'gemuese', months: range(6, 10), keys: ['mangold'], emoji: '🥬' },
  { name: 'Fenchel', kind: 'gemuese', months: range(6, 11), keys: ['fenchel'], exclude: ['samen', 'saat', 'tee'], emoji: '🌿' },
  { name: 'Staudensellerie', kind: 'gemuese', months: range(6, 10), keys: ['staudensellerie', 'stangensellerie', 'bleichsellerie'], emoji: '🥬' },
  { name: 'Radieschen', kind: 'gemuese', months: range(4, 9), keys: ['radieschen'], emoji: '🌱' },
  { name: 'Rucola', kind: 'gemuese', months: range(5, 10), keys: ['rucola', 'rauke'], emoji: '🥬' },
  { name: 'Kopfsalat', kind: 'gemuese', months: range(5, 10), keys: ['kopfsalat', 'eisberg', 'lollo', 'romanasalat', 'romana'], emoji: '🥬' },
  { name: 'Frühlingszwiebeln', kind: 'gemuese', months: range(4, 10), keys: ['frühlingszwiebel', 'lauchzwiebel'], emoji: '🧅' },
  { name: 'Spitzkohl', kind: 'gemuese', months: range(5, 11), keys: ['spitzkohl'], emoji: '🥬' },
  { name: 'Spinat', kind: 'gemuese', months: [3, 4, 5, 6, 9, 10, 11], keys: ['spinat'], exclude: PRESERVED, emoji: '🥬' },
  // Gemüse – Herbst & Winter
  { name: 'Rosenkohl', kind: 'gemuese', months: range(10, 2), keys: ['rosenkohl'], exclude: PRESERVED, emoji: '🥬' },
  { name: 'Feldsalat', kind: 'gemuese', months: range(10, 3), keys: ['feldsalat'], emoji: '🥬' },
  { name: 'Pastinaken', kind: 'gemuese', months: range(10, 3), keys: ['pastinake'], emoji: '🥕' },
  { name: 'Steckrübe', kind: 'gemuese', months: range(10, 2), keys: ['steckrübe', 'kohlrübe'], emoji: '🥔' },
  { name: 'Petersilienwurzel', kind: 'gemuese', months: range(9, 3), keys: ['petersilienwurzel'], emoji: '🥕' },
  { name: 'Knollensellerie', kind: 'gemuese', months: range(9, 3), keys: ['knollensellerie', 'sellerieknolle'], emoji: '🥔' },
  { name: 'Rote Bete', kind: 'gemuese', months: range(7, 3), keys: ['rote bete', 'rote beete', 'rote rübe'], exclude: ['saft', 'vorgegart', ...PRESERVED], emoji: '🟣' },
  { name: 'Lauch', kind: 'gemuese', months: range(6, 3), keys: ['lauch', 'porree'], exclude: ['lauchzwiebel', 'schnittlauch', 'bärlauch', 'knoblauch'], emoji: '🥬' },
  { name: 'Wirsing', kind: 'gemuese', months: range(6, 3), keys: ['wirsing'], emoji: '🥬' },
  { name: 'Weißkohl', kind: 'gemuese', months: range(7, 3), keys: ['weißkohl', 'weisskohl', 'krautkopf'], emoji: '🥬' },
  { name: 'Rotkohl', kind: 'gemuese', months: range(8, 3), keys: ['rotkohl', 'blaukraut', 'rotkraut'], exclude: PRESERVED, emoji: '🟣' },
  { name: 'Chinakohl', kind: 'gemuese', months: range(7, 1), keys: ['chinakohl'], emoji: '🥬' },
  { name: 'Chicorée', kind: 'gemuese', months: range(10, 3), keys: ['chicorée', 'chicoree'], emoji: '🥬' },
  // Pilze
  { name: 'Pfifferlinge', kind: 'pilz', months: range(7, 10), strict: true, keys: ['pfifferling'], exclude: PRESERVED, emoji: '🍄' },
  { name: 'Steinpilze', kind: 'pilz', months: range(8, 10), strict: true, keys: ['steinpilz'], exclude: PRESERVED, emoji: '🍄' },
  // Obst
  { name: 'Erdbeeren', kind: 'obst', months: range(5, 7), strict: true, keys: ['erdbeere'], exclude: ['marmelade', 'konfitüre', ...PRESERVED], emoji: '🍓' },
  { name: 'Kirschen', kind: 'obst', months: range(6, 8), strict: true, keys: ['kirsche'], exclude: ['saft', 'tomate', ...PRESERVED], emoji: '🍒' },
  { name: 'Johannisbeeren', kind: 'obst', months: range(6, 8), strict: true, keys: ['johannisbeere'], exclude: ['saft', 'gelee', ...PRESERVED], emoji: '🍇' },
  { name: 'Stachelbeeren', kind: 'obst', months: range(6, 7), strict: true, keys: ['stachelbeere'], exclude: PRESERVED, emoji: '🍈' },
  { name: 'Himbeeren', kind: 'obst', months: range(6, 9), keys: ['himbeere'], exclude: ['marmelade', 'konfitüre', ...PRESERVED], emoji: '🍓' },
  { name: 'Heidelbeeren', kind: 'obst', months: range(7, 9), keys: ['heidelbeere', 'blaubeere'], exclude: PRESERVED, emoji: '🫐' },
  { name: 'Brombeeren', kind: 'obst', months: range(7, 9), keys: ['brombeere'], exclude: PRESERVED, emoji: '🫐' },
  { name: 'Aprikosen', kind: 'obst', months: range(7, 8), keys: ['aprikose', 'marille'], exclude: ['getrocknet', 'marmelade', ...PRESERVED], emoji: '🍑' },
  { name: 'Zwetschgen', kind: 'obst', months: range(7, 10), strict: true, keys: ['zwetschge', 'zwetsche', 'pflaume'], exclude: ['getrocknet', 'mus', 'trocken', ...PRESERVED], emoji: '🟣' },
  { name: 'Mirabellen', kind: 'obst', months: range(8, 9), strict: true, keys: ['mirabelle'], exclude: PRESERVED, emoji: '🟡' },
  { name: 'Birnen', kind: 'obst', months: range(8, 1), keys: ['birne'], exclude: PRESERVED, emoji: '🍐' },
  { name: 'Weintrauben', kind: 'obst', months: range(9, 10), keys: ['weintraube', 'trauben'], exclude: ['saft', 'rosine'], emoji: '🍇' },
  { name: 'Quitten', kind: 'obst', months: range(9, 11), strict: true, keys: ['quitte'], exclude: ['gelee', 'brot'], emoji: '🍐' },
  { name: 'Maronen', kind: 'obst', months: range(10, 12), strict: true, keys: ['marone', 'esskastanie'], exclude: ['püree', 'mehl', 'vorgegart', ...PRESERVED], emoji: '🌰' },
];

/** Which produce does this ingredient name refer to? */
export function findProduce(name: string): Produce | undefined {
  const n = name.toLowerCase();
  for (const p of PRODUCE) {
    if (!p.keys.some((k) => n.includes(k))) continue;
    if (p.exclude?.some((x) => (x.length <= 3 ? new RegExp(`\\b${x}\\b`).test(n) : n.includes(x)))) continue;
    return p;
  }
  return undefined;
}

export const inSeason = (p: Produce, month: number) => p.months.includes(month);

export function produceInSeason(month: number, kind?: ProduceKind): Produce[] {
  return PRODUCE.filter((p) => inSeason(p, month) && (!kind || p.kind === kind));
}

export interface RecipeSeason {
  /** Produce in the recipe that is in season this month */
  hits: Produce[];
  /** Produce in the recipe that is out of season this month */
  misses: Produce[];
  /** A strictly seasonal ingredient (Spargel, Bärlauch…) is in season */
  strictHit: boolean;
  /** A strictly seasonal ingredient is out of season -> recipe not suggested */
  strictMiss: boolean;
  manual: boolean;
}

export function recipeSeason(recipe: Pick<Recipe, 'ingredients' | 'seasonMonths'>, month: number): RecipeSeason {
  if (recipe.seasonMonths && recipe.seasonMonths.length > 0 && recipe.seasonMonths.length < 12) {
    const ok = recipe.seasonMonths.includes(month);
    return { hits: [], misses: [], strictHit: ok, strictMiss: !ok, manual: true };
  }
  const seen = new Set<string>();
  const hits: Produce[] = [];
  const misses: Produce[] = [];
  for (const ing of recipe.ingredients) {
    const p = findProduce(ing.name);
    if (!p || seen.has(p.name)) continue;
    seen.add(p.name);
    (inSeason(p, month) ? hits : misses).push(p);
  }
  return {
    hits,
    misses,
    strictHit: hits.some((p) => p.strict),
    strictMiss: misses.some((p) => p.strict),
    manual: false,
  };
}

/** Months in which the recipe is "Saison" (strict ingredients or manual setting). Undefined = ganzjährig. */
export function recipeSeasonMonths(recipe: Pick<Recipe, 'ingredients' | 'seasonMonths'>): number[] | undefined {
  if (recipe.seasonMonths && recipe.seasonMonths.length > 0 && recipe.seasonMonths.length < 12) {
    return [...recipe.seasonMonths].sort((a, b) => a - b);
  }
  let months: number[] | undefined;
  for (const ing of recipe.ingredients) {
    const p = findProduce(ing.name);
    if (!p?.strict) continue;
    months = months ? months.filter((m) => p.months.includes(m)) : [...p.months];
  }
  return months && months.length > 0 ? months : undefined;
}

/** Score multiplier for the shuffle: >1 = passt gerade gut, <1 = eher nicht. */
export function seasonFactor(s: RecipeSeason): number {
  if (s.manual) return s.strictHit ? 3 : 1;
  let f = 1;
  if (s.strictHit) f *= 3;
  const softHits = s.hits.filter((p) => !p.strict).length;
  const softMisses = s.misses.filter((p) => !p.strict).length;
  f *= Math.min(2, 1 + 0.25 * softHits);
  f *= Math.max(0.5, 1 - 0.2 * softMisses);
  return f;
}

/** Format month list compactly: [4,5,6] -> "Apr–Jun", [10,11,12,1,2] -> "Okt–Feb" */
export function formatMonths(months: number[], names: string[]): string {
  if (months.length === 0) return '';
  if (months.length === 12) return 'ganzjährig';
  const set = new Set(months);
  // find a start month whose predecessor is not in the set
  const start = months.find((m) => !set.has(((m + 10) % 12) + 1)) ?? months[0];
  const parts: string[] = [];
  let m = start;
  const visited = new Set<number>();
  while (visited.size < set.size) {
    if (!set.has(m)) {
      m = (m % 12) + 1;
      continue;
    }
    const from = m;
    let to = m;
    visited.add(m);
    while (set.has((to % 12) + 1) && !visited.has((to % 12) + 1)) {
      to = (to % 12) + 1;
      visited.add(to);
    }
    parts.push(from === to ? names[from - 1] : `${names[from - 1]}–${names[to - 1]}`);
    m = (to % 12) + 1;
  }
  return parts.join(', ');
}
