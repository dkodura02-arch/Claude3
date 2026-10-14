import type { Ingredient } from './types';

const FRACTIONS: Record<string, string> = {
  '½': ' 1/2',
  '¼': ' 1/4',
  '¾': ' 3/4',
  '⅓': ' 1/3',
  '⅔': ' 2/3',
  '⅛': ' 1/8',
};

/** Canonical unit -> spellings (lowercase, without trailing dot) */
const UNIT_ALIASES: Record<string, string[]> = {
  g: ['g', 'gr', 'gramm'],
  kg: ['kg', 'kilo', 'kilogramm'],
  mg: ['mg'],
  ml: ['ml', 'milliliter'],
  cl: ['cl'],
  dl: ['dl'],
  l: ['l', 'liter', 'ltr'],
  EL: ['el', 'esslöffel', 'essl', 'eßl', 'tbsp'],
  TL: ['tl', 'teelöffel', 'teel', 'tsp'],
  Msp: ['msp', 'messerspitze', 'messerspitzen'],
  Prise: ['prise', 'prisen'],
  Stück: ['stück', 'stk', 'st', 'stücke'],
  Bund: ['bund', 'bd', 'bündel'],
  Dose: ['dose', 'dosen', 'ds'],
  Packung: ['packung', 'packungen', 'pck', 'pkg', 'päckchen', 'pack', 'pk', 'beutel', 'tüte'],
  Zehe: ['zehe', 'zehen'],
  Becher: ['becher'],
  Tasse: ['tasse', 'tassen', 'cup', 'cups'],
  Glas: ['glas', 'gläser'],
  Scheibe: ['scheibe', 'scheiben'],
  Handvoll: ['handvoll', 'hand voll'],
  Kopf: ['kopf', 'köpfe'],
  Stange: ['stange', 'stangen'],
  Zweig: ['zweig', 'zweige'],
  Blatt: ['blatt', 'blätter'],
  Knolle: ['knolle', 'knollen'],
  Würfel: ['würfel'],
  Schuss: ['schuss', 'spritzer'],
  Tropfen: ['tropfen'],
  cm: ['cm'],
  Stiel: ['stiel', 'stiele'],
  Kugel: ['kugel', 'kugeln'],
  Netz: ['netz'],
  Schale: ['schale', 'schalen'],
};

const UNIT_LOOKUP = new Map<string, string>();
for (const [canon, aliases] of Object.entries(UNIT_ALIASES)) {
  for (const a of aliases) UNIT_LOOKUP.set(a, canon);
}

function parseNumber(raw: string): number | undefined {
  const s = raw.trim().replace(',', '.');
  // "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const NUM = String.raw`\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?(?:\/\d+)?`;
const QTY_RE = new RegExp(String.raw`^(${NUM})(?:\s*(?:-|–|bis)\s*(${NUM}))?\s*`);

/** Parse a free-form ingredient line like "1–2 EL Olivenöl (extra vergine)". */
export function parseIngredient(line: string): Ingredient {
  const text = line.replace(/\s+/g, ' ').trim();
  let rest = text;
  for (const [f, r] of Object.entries(FRACTIONS)) rest = rest.split(f).join(r);
  rest = rest.trim();

  let qty: number | undefined;
  const m = rest.match(QTY_RE);
  if (m) {
    const a = parseNumber(m[1]);
    const b = m[2] ? parseNumber(m[2]) : undefined;
    qty = b ?? a;
    rest = rest.slice(m[0].length);
  }

  let unit: string | undefined;
  const um = rest.match(/^([A-Za-zÄÖÜäöüß]+)\.?(?=\s|$)/);
  if (um) {
    const canon = UNIT_LOOKUP.get(um[1].toLowerCase());
    // Single letters like "l"/"g" only count as unit right after a number
    if (canon && (um[1].length > 1 || qty !== undefined)) {
      unit = canon;
      rest = rest.slice(um[0].length).trim();
    }
  }
  // "200 g" written as "200g"
  if (qty === undefined && !unit) {
    const glued = rest.match(/^(\d+(?:[.,]\d+)?)([A-Za-zäöü]+)\.?\s+(.*)$/);
    if (glued && UNIT_LOOKUP.has(glued[2].toLowerCase())) {
      qty = parseNumber(glued[1]);
      unit = UNIT_LOOKUP.get(glued[2].toLowerCase());
      rest = glued[3];
    }
  }

  rest = rest.replace(/^(von|vom|der|die|das)\s+/i, '');
  let note: string | undefined;
  const notes: string[] = [];
  rest = rest.replace(/\(([^)]*)\)/g, (_, n: string) => {
    notes.push(n.trim());
    return ' ';
  });
  const comma = rest.indexOf(',');
  if (comma > 0) {
    notes.push(rest.slice(comma + 1).trim());
    rest = rest.slice(0, comma);
  }
  if (notes.length) note = notes.filter(Boolean).join(', ') || undefined;
  const name = rest.replace(/\s+/g, ' ').trim() || text;

  const ing: Ingredient = { text, name };
  if (qty !== undefined) ing.qty = qty;
  if (unit) ing.unit = unit;
  if (note) ing.note = note;
  return ing;
}

export function parseIngredientLines(text: string): Ingredient[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^[\s•\-*–·▪]+/, '').trim())
    .filter(Boolean)
    .map(parseIngredient);
}

/** Lowercased, accent-preserving, singular-ish key used for matching and merging. */
export function ingredientKey(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[^a-zäöüß\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOPWORDS.has(w));
  return words.map(stem).join(' ');
}

const STOPWORDS = new Set([
  'frisch',
  'frische',
  'frischer',
  'frischen',
  'klein',
  'kleine',
  'kleiner',
  'groß',
  'große',
  'großer',
  'mittelgroße',
  'mittelgroßer',
  'etwas',
  'n',
  'nach',
  'belieben',
  'bio',
  'ca',
  'evtl',
  'optional',
]);

function stem(w: string): string {
  if (w.length <= 4) return w;
  return w.replace(/(en|n|e|s)$/, '');
}

const WEIGHT: Record<string, [string, number]> = { g: ['g', 1], kg: ['g', 1000], mg: ['g', 0.001] };
const VOLUME: Record<string, [string, number]> = {
  ml: ['ml', 1],
  cl: ['ml', 10],
  dl: ['ml', 100],
  l: ['ml', 1000],
};

function baseUnit(unit?: string): [string, number] {
  if (!unit) return ['', 1];
  return WEIGHT[unit] ?? VOLUME[unit] ?? [unit, 1];
}

const PLURAL_UNITS: Record<string, string> = {
  Prise: 'Prisen',
  Dose: 'Dosen',
  Packung: 'Packungen',
  Zehe: 'Zehen',
  Tasse: 'Tassen',
  Scheibe: 'Scheiben',
  Stange: 'Stangen',
  Zweig: 'Zweige',
  Blatt: 'Blätter',
  Knolle: 'Knollen',
  Kugel: 'Kugeln',
  Stiel: 'Stiele',
  Glas: 'Gläser',
  Kopf: 'Köpfe',
  Schale: 'Schalen',
};

export function formatQty(qty: number, unit: string): string {
  let q = qty;
  let u = unit;
  if (u === 'g' && q >= 1000) {
    q = q / 1000;
    u = 'kg';
  } else if (u === 'ml' && q >= 1000) {
    q = q / 1000;
    u = 'l';
  }
  const rounded = Math.round(q * 100) / 100;
  const str = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  if (rounded > 1 && PLURAL_UNITS[u]) u = PLURAL_UNITS[u];
  return u ? `${str} ${u}` : str;
}

export interface AggregatedItem {
  key: string;
  name: string;
  /** Formatted quantities, e.g. ["600 g", "2 Stück"] */
  amounts: string[];
  /** Original lines without a quantity ("Salz", "Pfeffer") */
  sources: string[];
  category: Category;
}

/** Merge ingredient lists: same ingredient + compatible unit gets summed. */
export function aggregate(lists: { ingredients: Ingredient[]; from: string }[]): AggregatedItem[] {
  const byKey = new Map<string, { name: string; qty: Map<string, number>; free: boolean; sources: Set<string> }>();
  for (const list of lists) {
    for (const ing of list.ingredients) {
      const key = ingredientKey(ing.name) || ing.name.toLowerCase();
      let entry = byKey.get(key);
      if (!entry) {
        entry = { name: ing.name, qty: new Map(), free: false, sources: new Set() };
        byKey.set(key, entry);
      }
      entry.sources.add(list.from);
      if (ing.qty !== undefined) {
        const [u, f] = baseUnit(ing.unit);
        entry.qty.set(u, (entry.qty.get(u) ?? 0) + ing.qty * f);
      } else {
        entry.free = true;
      }
    }
  }
  const out: AggregatedItem[] = [];
  for (const [key, e] of byKey) {
    const amounts = [...e.qty.entries()].map(([u, q]) => formatQty(q, u));
    out.push({ key, name: e.name, amounts, sources: [...e.sources], category: categorize(e.name) });
  }
  return out;
}

export type Category =
  | 'gemuese'
  | 'kuehl'
  | 'trocken'
  | 'konserven'
  | 'gewuerze'
  | 'backen'
  | 'tk'
  | 'sonstiges';

export const CATEGORY_LABELS: Record<Category, string> = {
  gemuese: 'Obst & Gemüse',
  kuehl: 'Kühlregal',
  trocken: 'Nudeln, Reis & Co.',
  konserven: 'Konserven & Gläser',
  gewuerze: 'Gewürze, Öl & Saucen',
  backen: 'Backen & Brot',
  tk: 'Tiefkühl',
  sonstiges: 'Sonstiges',
};

export const CATEGORY_ORDER: Category[] = [
  'gemuese',
  'kuehl',
  'trocken',
  'konserven',
  'backen',
  'gewuerze',
  'tk',
  'sonstiges',
];

const CATEGORY_WORDS: [Category, string[]][] = [
  ['tk', [' tk ', 'tiefgekühlt', 'tiefkühl', 'gefroren']],
  [
    'konserven',
    ['dose', 'passiert', 'gehackte tomaten', 'tomatenmark', 'kokosmilch', 'kichererbsen', 'kidney', 'mais', 'glas', 'eingelegt', 'pizzatomaten', 'polpa'],
  ],
  [
    'gewuerze',
    ['salz', 'pfeffer', 'öl', 'essig', 'paprikapulver', 'curry', 'kreuzkümmel', 'kumin', 'zimt', 'muskat', 'oregano', 'thymian getrocknet', 'chili', 'sojasauce', 'sojasoße', 'senf', 'brühe', 'fond', 'gewürz', 'zucker', 'honig', 'sirup', 'ketchup', 'sambal', 'harissa', 'tahin', 'pesto', 'kurkuma', 'garam', 'lorbeer', 'koriander gemahlen', 'vanille'],
  ],
  [
    'kuehl',
    ['milch', 'sahne', 'schmand', 'quark', 'joghurt', 'butter', 'käse', 'feta', 'mozzarella', 'parmesan', 'ricotta', 'frischkäse', ' ei ', 'eier', 'crème', 'creme', 'tofu', 'halloumi', 'mascarpone', 'skyr', 'burrata', 'gnocchi', 'blätterteig', 'pizzateig'],
  ],
  [
    'trocken',
    ['nudel', 'spaghetti', 'penne', 'pasta', 'fusilli', 'tagliatelle', 'linguine', 'lasagne', 'reis', 'risotto', 'bulgur', 'couscous', 'quinoa', 'linsen', 'haferflocken', 'nüsse', 'mandeln', 'cashew', 'erdnüsse', 'sesam', 'kerne', 'rosinen', 'orzo', 'polenta', 'graupen', ' mie '],
  ],
  ['backen', ['mehl', 'hefe', 'backpulver', 'brot', 'brötchen', 'toast', 'semmel', 'tortilla', 'wraps', 'fladenbrot', 'stärke', 'paniermehl', 'semmelbrösel']],
  [
    'gemuese',
    ['kartoffel', 'zwiebel', 'knoblauch', 'möhre', 'karotte', 'tomate', 'paprika', 'zucchini', 'aubergine', 'gurke', 'salat', 'spinat', 'brokkoli', 'blumenkohl', 'kohl', 'lauch', 'porree', 'sellerie', 'fenchel', 'kürbis', 'spargel', 'pilz', 'champignon', 'apfel', 'birne', 'zitrone', 'limette', 'orange', 'banane', 'beere', 'ingwer', 'petersilie', 'koriander', 'basilikum', 'schnittlauch', 'dill', 'minze', 'rosmarin', 'thymian', 'avocado', 'mango', 'bohnen', 'erbsen', 'radieschen', 'rucola', 'mangold', 'rote bete', 'süßkartoffel', 'frühlingszwiebel', 'schalotte', 'chicorée', 'pastinake', 'rübe', 'kohlrabi', 'gemüse', 'kräuter', 'rhabarber', 'bärlauch'],
  ],
];

export function categorize(name: string): Category {
  // Padded so that entries written with spaces (" ei ") match whole words only
  const n = ` ${name.toLowerCase().replace(/[^a-zäöüß]+/g, ' ')} `;
  for (const [cat, words] of CATEGORY_WORDS) {
    if (words.some((w) => n.includes(w))) return cat;
  }
  return 'sonstiges';
}

/** Does the ingredient name refer to the given pantry item (e.g. "Brokkoli" vs "1 Brokkoli, in Röschen")? */
export function matchesPantry(ingredientName: string, pantryName: string): boolean {
  const a = ingredientKey(ingredientName);
  const b = ingredientKey(pantryName);
  if (!a || !b) return false;
  if (a === b) return true;
  // whole-word containment both ways: "cherry tomat" ~ "tomat"
  const aw = a.split(' ');
  const bw = b.split(' ');
  return bw.every((w) => aw.some((x) => x === w || (w.length >= 5 && x.endsWith(w))));
}
