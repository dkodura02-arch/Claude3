import { matchesPantry } from './ingredients';
import { effortLevel } from './labels';
import { findProduce, recipeSeason, seasonFactor } from './season';
import { weekMonth, weeksBetween } from './dates';
import type { Batch, Carb, Effort, Price, Recipe, WeekPlan } from './types';

export interface ShuffleFilters {
  maxEffort?: Effort;
  maxPrice?: Price;
}

export interface ShuffleContext {
  recipes: Recipe[];
  plans: WeekPlan[];
  /** Target week (Monday, YYYY-MM-DD) */
  week: string;
  pantry: string[];
  filters?: ShuffleFilters;
  rng?: () => number;
}

export interface SlotPick {
  recipe: Recipe;
  reasons: string[];
  /** Set when a rule had to be relaxed to find anything */
  relaxed?: string;
}

/** Favourites are this many times as likely to be picked. */
const FAVORITE_FACTOR = 2;
/** Share of the Big Batch pool that is blocked after being cooked (no repeats). */
const BIG_REPEAT_WINDOW = 0.6;
/** Previous plans further back than this don't count for "directly after each other". */
const CONSECUTIVE_MAX_GAP = 3;

const EXTRA_VEG = [
  'möhre',
  'karotte',
  'champignon',
  'pilz',
  'süßkartoffel',
  'erbse',
  'mais',
  'pak choi',
  'sprossen',
  'edamame',
  'okra',
];

export function isVegetable(name: string): boolean {
  const p = findProduce(name);
  if (p) return p.kind === 'gemuese' || p.kind === 'pilz';
  const n = name.toLowerCase();
  return EXTRA_VEG.some((v) => n.includes(v)) && !n.includes('kicher');
}

/** Plans before the target week, newest first */
function history(ctx: ShuffleContext): WeekPlan[] {
  return ctx.plans.filter((p) => p.week < ctx.week).sort((a, b) => (a.week < b.week ? 1 : -1));
}

/** Weeks since each recipe was last on the plan (any slot). */
export function lastCookedWeeks(ctx: Pick<ShuffleContext, 'plans' | 'week'>): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of ctx.plans) {
    if (p.week >= ctx.week) continue;
    const ago = weeksBetween(p.week, ctx.week);
    for (const id of [p.big, p.small]) {
      if (!id) continue;
      const prev = map.get(id);
      if (prev === undefined || ago < prev) map.set(id, ago);
    }
  }
  return map;
}

function passesFilters(r: Recipe, f?: ShuffleFilters): boolean {
  if (!f) return true;
  if (f.maxEffort && effortLevel(r.effort) > effortLevel(f.maxEffort)) return false;
  if (f.maxPrice && r.price > f.maxPrice) return false;
  return true;
}

interface Scored {
  recipe: Recipe;
  weight: number;
  reasons: string[];
  strictMiss: boolean;
}

function pantryMatches(r: Recipe, pantry: string[]): { direct: string[]; flex: string[] } {
  const direct: string[] = [];
  const flex: string[] = [];
  for (const item of pantry) {
    if (r.ingredients.some((ing) => matchesPantry(ing.name, item))) direct.push(item);
    else if (r.flexVeg && isVegetable(item)) flex.push(item);
  }
  return { direct, flex };
}

function score(r: Recipe, ctx: ShuffleContext, cooked: Map<string, number>, useRecency: boolean): Scored {
  const reasons: string[] = [];
  let weight = 1;
  if (r.favorite) {
    weight *= FAVORITE_FACTOR;
    reasons.push('Favorit');
  }

  const season = recipeSeason(r, weekMonth(ctx.week));
  weight *= seasonFactor(season);
  if (season.manual && season.strictHit) reasons.push('Hat gerade Saison');
  else if (season.hits.length) {
    const names = [...season.hits].sort((a, b) => Number(!!b.strict) - Number(!!a.strict)).map((p) => p.name);
    reasons.push(`Saison: ${names.slice(0, 3).join(', ')}`);
  }

  const { direct, flex } = pantryMatches(r, ctx.pantry);
  // what's in the fridge should get used: each matching ingredient counts a lot, flexible vegetables a bit less
  const pantryBoost = 1.5 * direct.length + (flex.length ? 1 : 0);
  if (pantryBoost) weight *= Math.min(6, 1 + pantryBoost);
  if (direct.length) reasons.push(`Habt ihr da: ${direct.join(', ')}`);
  if (flex.length) reasons.push(`Flexibles Gemüse: ${flex.join(', ')}`);

  if (useRecency) {
    const ago = cooked.get(r.id);
    if (ago === undefined) {
      weight *= 3;
      // only worth mentioning once there is some history
      if (cooked.size > 0) reasons.push('Noch nie gekocht');
    } else {
      weight *= 1 + Math.min(ago, 12) / 4;
      if (ago >= 8) reasons.push(`Seit ${ago} Wochen nicht gekocht`);
    }
  }
  return { recipe: r, weight, reasons, strictMiss: season.strictMiss };
}

function weightedPick<T extends { weight: number }>(items: T[], rng: () => number): T | undefined {
  const total = items.reduce((s, x) => s + x.weight, 0);
  if (!items.length || total <= 0) return items[0];
  let x = rng() * total;
  for (const it of items) {
    x -= it.weight;
    if (x <= 0) return it;
  }
  return items[items.length - 1];
}

const carbClash = (a?: Carb, b?: Carb) => !!a && !!b && a !== 'ohne' && a === b;

interface Step {
  /** Text shown when this relaxation was needed */
  note?: string;
  accept: (s: Scored) => boolean;
}

function pickWithSteps(scored: Scored[], steps: Step[], rng: () => number): SlotPick | null {
  for (const step of steps) {
    const ok = scored.filter(step.accept);
    const chosen = weightedPick(ok, rng);
    if (chosen) return { recipe: chosen.recipe, reasons: chosen.reasons, relaxed: step.note };
  }
  return null;
}

export interface PickOptions {
  /** Recipes not to suggest (e.g. the ones just shown when reshuffling) */
  exclude?: string[];
  /** Carb of the other dish this week */
  otherCarb?: Carb;
  /** The other dish this week – sharing its main vegetable (Kürbis & Kürbis) is less likely */
  other?: Recipe;
}

function sharesProduce(a: Recipe, b?: Recipe): boolean {
  if (!b) return false;
  const names = new Set(b.ingredients.map((i) => findProduce(i.name)?.name).filter(Boolean));
  return a.ingredients.some((i) => {
    const p = findProduce(i.name);
    return !!p && names.has(p.name);
  });
}

function pool(ctx: ShuffleContext, batch: Batch, exclude: Set<string>): Recipe[] {
  return ctx.recipes.filter((r) => r.batch === batch && passesFilters(r, ctx.filters) && !exclude.has(r.id));
}

/**
 * Big Batch: no repeats (recently cooked ones are blocked, longest-not-cooked preferred),
 * carb differs from last week's Big Batch and from this week's Small Batch.
 */
export function pickBig(ctx: ShuffleContext, opts: PickOptions = {}): SlotPick | null {
  const rng = ctx.rng ?? Math.random;
  const exclude = new Set(opts.exclude ?? []);
  const candidates = pool(ctx, 'big', exclude);
  if (!candidates.length) return null;

  const cooked = lastCookedWeeks(ctx);
  const prev = history(ctx).find((p) => weeksBetween(p.week, ctx.week) <= CONSECUTIVE_MAX_GAP);
  const byId = new Map(ctx.recipes.map((r) => [r.id, r]));
  const prevBigCarb = prev?.big ? byId.get(prev.big)?.carb : undefined;
  const prevSmallCarb = prev?.small ? byId.get(prev.small)?.carb : undefined;

  const scored = candidates.map((r) => {
    const s = score(r, ctx, cooked, true);
    // Weekend dish -> Monday: same carb directly after each other is not ideal
    if (carbClash(r.carb, prevSmallCarb)) s.weight *= 0.4;
    if (sharesProduce(r, opts.other)) s.weight *= 0.25;
    return s;
  });

  const inSeasonCount = scored.filter((s) => !s.strictMiss).length;
  const window = Math.max(1, Math.ceil(inSeasonCount * BIG_REPEAT_WINDOW));
  const recentOk = (s: Scored, w: number) => {
    const ago = cooked.get(s.recipe.id);
    return ago === undefined || ago > w;
  };
  const carbOk = (s: Scored) => !carbClash(s.recipe.carb, prevBigCarb) && !carbClash(s.recipe.carb, opts.otherCarb);

  return pickWithSteps(
    scored,
    [
      { accept: (s) => !s.strictMiss && recentOk(s, window) && carbOk(s) },
      { accept: (s) => !s.strictMiss && recentOk(s, Math.floor(window / 2)) && carbOk(s) },
      { note: 'Beilage wiederholt sich – zu wenige passende Rezepte', accept: (s) => !s.strictMiss && recentOk(s, Math.floor(window / 2)) },
      { note: 'Wurde erst kürzlich gekocht – zu wenige Big-Batch-Rezepte', accept: (s) => !s.strictMiss && carbOk(s) },
      { note: 'Wurde erst kürzlich gekocht – zu wenige Big-Batch-Rezepte', accept: (s) => !s.strictMiss },
      { note: 'Hat eigentlich gerade keine Saison', accept: () => true },
    ],
    rng,
  );
}

/** Small Batch: may repeat any time, carb differs from this week's Big Batch. */
export function pickSmall(ctx: ShuffleContext, opts: PickOptions = {}): SlotPick | null {
  const rng = ctx.rng ?? Math.random;
  const exclude = new Set(opts.exclude ?? []);
  const candidates = pool(ctx, 'small', exclude);
  if (!candidates.length) return null;

  const cooked = lastCookedWeeks(ctx);
  const scored = candidates.map((r) => {
    const s = score(r, ctx, cooked, false);
    // allowed to repeat, just slightly less likely right after last weekend
    if (cooked.get(r.id) === 1) s.weight *= 0.5;
    if (sharesProduce(r, opts.other)) s.weight *= 0.25;
    return s;
  });
  const carbOk = (s: Scored) => !carbClash(s.recipe.carb, opts.otherCarb);

  return pickWithSteps(
    scored,
    [
      { accept: (s) => !s.strictMiss && carbOk(s) },
      { note: 'Gleiche Beilage wie der Big Batch – zu wenige passende Rezepte', accept: (s) => !s.strictMiss },
      { note: 'Hat eigentlich gerade keine Saison', accept: () => true },
    ],
    rng,
  );
}

export type Slot = 'big' | 'small';

export interface ShuffleResult {
  plan: WeekPlan;
  picks: Partial<Record<Slot, SlotPick | null>>;
}

/**
 * Shuffle the unlocked slots of a week. `only` restricts to one slot (reshuffle a single dish).
 * `seen` holds recipes already shown for a slot, so a reshuffle brings something new.
 */
export function shuffleWeek(
  ctx: ShuffleContext,
  plan: WeekPlan,
  only?: Slot,
  seen: Partial<Record<Slot, string[]>> = {},
): ShuffleResult {
  const byId = new Map(ctx.recipes.map((r) => [r.id, r]));
  const next: WeekPlan = { ...plan, week: ctx.week };
  const picks: ShuffleResult['picks'] = {};
  const doBig = (!only || only === 'big') && !plan.lockBig;
  const doSmall = (!only || only === 'small') && !plan.lockSmall;

  const withSeen = (slot: Slot, current?: string) => {
    const ex = [...(seen[slot] ?? [])];
    if (current) ex.push(current);
    return ex;
  };

  if (doBig) {
    // when both are shuffled, the small dish adapts to the big one
    const other = doSmall ? undefined : plan.small ? byId.get(plan.small) : undefined;
    const otherCarb = other?.carb;
    let pick = pickBig(ctx, { exclude: withSeen('big', plan.big), otherCarb, other });
    // everything seen already -> start over, but still avoid the dish on screen
    if (!pick) pick = pickBig(ctx, { exclude: plan.big ? [plan.big] : [], otherCarb, other });
    if (!pick && plan.big) pick = pickBig(ctx, { otherCarb, other });
    picks.big = pick;
    if (pick) next.big = pick.recipe.id;
  }
  if (doSmall) {
    const other = next.big ? byId.get(next.big) : undefined;
    const otherCarb = other?.carb;
    let pick = pickSmall(ctx, { exclude: withSeen('small', plan.small), otherCarb, other });
    if (!pick) pick = pickSmall(ctx, { exclude: plan.small ? [plan.small] : [], otherCarb, other });
    if (!pick && plan.small) pick = pickSmall(ctx, { otherCarb, other });
    picks.small = pick;
    if (pick) next.small = pick.recipe.id;
  }
  return { plan: next, picks };
}

/** Reasons why a recipe fits this week (for dishes already on the plan). */
export function explain(recipe: Recipe, ctx: ShuffleContext): string[] {
  const cooked = lastCookedWeeks(ctx);
  return score(recipe, ctx, cooked, recipe.batch === 'big').reasons;
}
