import { describe, expect, it } from 'vitest';
import { hasLegumes, isLegume, parseIngredient } from './ingredients';
import { guessCarb } from './importer';
import { starterRecipes, updateStoredStarterRecipes } from './samples';
import { shuffleWeek, type ShuffleContext } from './shuffle';
import { store } from './store';
import type { Recipe } from './types';

const base: Omit<Recipe, 'id' | 'title'> = {
  batch: 'big',
  effort: 'mittel',
  price: 2,
  carb: 'reis',
  ingredients: [],
  steps: [],
  createdAt: 0,
};
const r = (id: string, extra: Partial<Recipe> = {}): Recipe => ({ ...base, id, title: id, ...extra });

function ctx(recipes: Recipe[], filters: ShuffleContext['filters'], seed = 1): ShuffleContext {
  let a = seed * 2654435761;
  const rng = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { recipes, plans: [], week: '2026-10-26', pantry: [], filters, rng };
}

describe('shuffle filters', () => {
  const recipes = [
    r('slow', { slowCooker: true, carb: 'kartoffeln' }),
    r('stove', { carb: 'nudeln' }),
    r('slowSmall', { batch: 'small', slowCooker: true, carb: 'reis', effort: 'leicht' }),
    r('quickSmall', { batch: 'small', carb: 'ohne', effort: 'leicht' }),
  ];

  it('"Nur mit Slow Cooker" picks only slow-cooker Big Batches and leaves the Small Batch alone', () => {
    const smalls = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const res = shuffleWeek(ctx(recipes, { slowCooker: 'only' }, i + 1), { week: '2026-10-26' });
      expect(res.plan.big).toBe('slow');
      smalls.add(res.plan.small!);
    }
    expect(smalls).toEqual(new Set(['slowSmall', 'quickSmall']));
  });

  it('"Ohne Slow Cooker" skips slow-cooker Big Batches', () => {
    for (let i = 0; i < 30; i++) {
      expect(shuffleWeek(ctx(recipes, { slowCooker: 'exclude' }, i + 1), { week: '2026-10-26' }).plan.big).toBe('stove');
    }
  });

  it('"Nur leicht" applies to both dishes', () => {
    const res = shuffleWeek(ctx([...recipes, r('easyBig', { effort: 'leicht', carb: 'linsen' })], { maxEffort: 'leicht' }), { week: '2026-10-26' });
    expect(res.plan.big).toBe('easyBig');
    expect(['slowSmall', 'quickSmall']).toContain(res.plan.small);
  });

  it('reports an empty slot when nothing matches', () => {
    const res = shuffleWeek(ctx([r('stove')], { slowCooker: 'only' }), { week: '2026-10-26' });
    expect(res.picks.big).toBeNull();
  });
});

describe('Hülsenfrüchte', () => {
  it('recognises legumes but not green beans, peas or coffee', () => {
    for (const n of ['rote Linsen', 'Kichererbsen', 'Kidneybohnen', 'weiße Bohnen', 'gelbe Schälerbsen', 'Augenbohnen']) expect(isLegume(n), n).toBe(true);
    for (const n of ['grüne Bohnen', 'TK-Erbsen', 'Zuckerschoten', 'Kaffeebohnen', 'Bohnenkraut']) expect(isLegume(n), n).toBe(false);
  });

  it('uses Hülsenfrüchte as carb only when nothing else is the base', () => {
    const ing = (...l: string[]) => l.map(parseIngredient);
    expect(guessCarb(ing('2 Dosen Kichererbsen', '1 Dose Tomaten'))).toBe('linsen');
    expect(guessCarb(ing('1 Dose Kidneybohnen', '400 g Reis'))).toBe('reis');
    expect(guessCarb(ing('300 g TK-Erbsen', '2 Möhren'))).toBe('ohne');
    expect(hasLegumes({ ingredients: ing('1 Dose Kidneybohnen', '400 g Reis') })).toBe(true);
  });
});

describe('collection updates', () => {
  it('marks slow-cooker dishes in the collection', () => {
    const slow = starterRecipes().filter((s) => s.slowCooker);
    expect(slow.length).toBeGreaterThanOrEqual(6);
    expect(slow.every((s) => s.batch === 'big' && s.notes?.startsWith('Slow Cooker'))).toBe(true);
    expect(starterRecipes().find((s) => s.id === 'start-erbsensuppe')?.carb).toBe('linsen');
  });

  it('adds the flag to collection recipes loaded before, but respects a switched-off flag', () => {
    const chili = starterRecipes().find((s) => s.title === 'Chili sin Carne')!;
    const dal = starterRecipes().find((s) => s.id === 'start-dal')!;
    const soup = starterRecipes().find((s) => s.id === 'start-erbsensuppe')!;
    // as stored by the previous version: no flag, no note, old carb
    const old = (s: Recipe): Recipe => ({ ...s, slowCooker: undefined, notes: undefined });
    store.put('recipes', chili.id, old(chili));
    store.put('recipes', soup.id, { ...old(soup), carb: 'ohne' });
    store.put('recipes', dal.id, { ...old(dal), slowCooker: false });

    expect(updateStoredStarterRecipes()).toBe(2);
    expect(store.get('recipes', chili.id)).toMatchObject({ slowCooker: true, notes: chili.notes });
    expect(store.get('recipes', soup.id)).toMatchObject({ slowCooker: true, carb: 'linsen' });
    expect(store.get('recipes', dal.id)?.slowCooker).toBe(false);
    expect(updateStoredStarterRecipes()).toBe(0);
  });
});
