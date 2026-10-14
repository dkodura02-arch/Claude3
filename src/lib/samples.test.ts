import { describe, expect, it } from 'vitest';
import { addStarterRecipes, missingStarterCount, starterRecipes } from './samples';
import { store } from './store';
import { pickBig, shuffleWeek, type ShuffleContext } from './shuffle';
import { addWeeks, weekMonth } from './dates';
import { recipeSeasonMonths } from './season';
import type { Recipe, WeekPlan } from './types';

const MEAT = /\b(speck|bacon|hähnchen|huhn|hühner|rind|schwein|hackfleisch|wurst|würstchen|schinken|lachs|thunfisch|garnele|fleisch|salami)/i;

function rng(seed: number) {
  // mulberry32 – good spread even for small, consecutive seeds
  let a = seed * 2654435761;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('starter collection', () => {
  const all = starterRecipes();

  it('is a sizeable, well-formed, meat-free collection', () => {
    expect(all.length).toBeGreaterThanOrEqual(40);
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    for (const r of all) {
      expect(r.ingredients.length, r.title).toBeGreaterThan(3);
      expect(r.steps.length, r.title).toBeGreaterThan(1);
      for (const i of r.ingredients) expect(i.name, `${r.title}: ${i.text}`).not.toMatch(MEAT);
    }
  });

  it('is mostly simple and cheap, with variety for the rotation', () => {
    const cheap = all.filter((r) => r.price <= 2 && r.effort !== 'aufwendig');
    expect(cheap.length / all.length).toBeGreaterThan(0.8);
    const bigs = all.filter((r) => r.batch === 'big');
    for (const carb of ['kartoffeln', 'reis', 'nudeln'] as const) {
      expect(bigs.filter((r) => r.carb === carb).length, carb).toBeGreaterThanOrEqual(4);
    }
    expect(all.filter((r) => r.batch === 'small').length).toBeGreaterThanOrEqual(15);
  });

  it('runs a whole year of shuffling without breaking the rules', () => {
    const plans: WeekPlan[] = [];
    let week = '2027-01-04';
    for (let i = 0; i < 52; i++) {
      const ctx: ShuffleContext = { recipes: all, plans, week, pantry: [], rng: rng(i + 3) };
      const res = shuffleWeek(ctx, { week });
      const big = all.find((r) => r.id === res.plan.big)!;
      const small = all.find((r) => r.id === res.plan.small)!;
      expect(res.picks.big?.relaxed).toBeUndefined();
      expect(res.picks.small?.relaxed).toBeUndefined();
      // seasonal dishes only in season
      for (const r of [big, small]) {
        const months = recipeSeasonMonths(r);
        if (months) expect(months, `${r.title} in ${week}`).toContain(weekMonth(week));
      }
      // carbs: different within the week (unless "ohne") and Big Batch differs from last week
      if (big.carb !== 'ohne') expect(small.carb).not.toBe(big.carb);
      const last = plans[plans.length - 1];
      if (last) {
        const lastBig = all.find((r) => r.id === last.big)!;
        if (big.carb !== 'ohne') expect(big.carb).not.toBe(lastBig.carb);
      }
      // no Big Batch repeats within the blocked window
      expect(plans.slice(-6).map((p) => p.big)).not.toContain(big.id);
      plans.push(res.plan);
      week = addWeeks(week, 1);
    }
  });
});

describe('favourites', () => {
  it('come up about twice as often', () => {
    const base: Omit<Recipe, 'id' | 'title'> = { batch: 'big', effort: 'leicht', price: 1, carb: 'reis', ingredients: [], steps: [], createdAt: 0 };
    const fav = { ...base, id: 'f', title: 'Fav', favorite: true };
    const other = { ...base, id: 'o', title: 'Other' };
    let favs = 0;
    for (let i = 0; i < 600; i++) {
      const p = pickBig({ recipes: [fav, other], plans: [], week: '2026-10-19', pantry: [], rng: rng(i + 1) });
      if (p?.recipe.id === 'f') {
        favs++;
        expect(p.reasons[0]).toBe('Favorit');
      }
    }
    expect(favs / 600).toBeGreaterThan(0.6);
    expect(favs / 600).toBeLessThan(0.74);
  });
});

describe('loading the collection', () => {
  it('adds missing recipes once and does not bring back deleted ones', () => {
    const total = starterRecipes().length;
    expect(missingStarterCount()).toBe(total);
    expect(addStarterRecipes()).toBe(total);
    expect(missingStarterCount()).toBe(0);

    store.remove('recipes', 'start-dal');
    expect(missingStarterCount()).toBe(0);
    expect(addStarterRecipes()).toBe(0);
    expect(store.get('recipes', 'start-dal')).toBeUndefined();

    // explicitly re-adding from the settings brings it back
    expect(missingStarterCount({ includeDeleted: true })).toBe(1);
    expect(addStarterRecipes({ includeDeleted: true })).toBe(1);
    expect(store.get('recipes', 'start-dal')?.title).toBe('Rote-Linsen-Dal mit Fladenbrot');
  });
});
