import { describe, expect, it } from 'vitest';
import { aggregate, categorize, ingredientKey, matchesPantry, parseIngredient } from './ingredients';
import { findProduce, formatMonths, recipeSeason, recipeSeasonMonths } from './season';
import { pickBig, pickSmall, shuffleWeek, type ShuffleContext } from './shuffle';
import { addWeeks, planningWeek, weekMonth } from './dates';
import { guessCarb, parseDuration, parseRecipeHtml, parseRecipeText } from './importer';
import { MONTHS_SHORT } from './labels';
import type { Carb, Recipe, WeekPlan } from './types';

function seededRng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

let n = 0;
function recipe(partial: Partial<Recipe> & { title: string }): Recipe {
  n++;
  return {
    id: partial.id ?? `r${n}`,
    batch: 'big',
    effort: 'mittel',
    price: 2,
    carb: 'reis',
    ingredients: [],
    steps: [],
    createdAt: 0,
    ...partial,
  };
}

const ing = (...lines: string[]) => lines.map(parseIngredient);

describe('parseIngredient', () => {
  it('parses amount, unit and name', () => {
    expect(parseIngredient('200 g Spaghetti')).toMatchObject({ qty: 200, unit: 'g', name: 'Spaghetti' });
    expect(parseIngredient('1 ½ EL Olivenöl')).toMatchObject({ qty: 1.5, unit: 'EL', name: 'Olivenöl' });
    expect(parseIngredient('2-3 Zehen Knoblauch, fein gehackt')).toMatchObject({
      qty: 3,
      unit: 'Zehe',
      name: 'Knoblauch',
      note: 'fein gehackt',
    });
    expect(parseIngredient('500g Hackfleisch')).toMatchObject({ qty: 500, unit: 'g', name: 'Hackfleisch' });
    expect(parseIngredient('1 Dose Kokosmilch (400 ml)')).toMatchObject({ qty: 1, unit: 'Dose', name: 'Kokosmilch', note: '400 ml' });
    expect(parseIngredient('Salz und Pfeffer')).toMatchObject({ name: 'Salz und Pfeffer' });
    expect(parseIngredient('0,5 l Gemüsebrühe')).toMatchObject({ qty: 0.5, unit: 'l', name: 'Gemüsebrühe' });
    expect(parseIngredient('3 Kartoffeln')).toMatchObject({ qty: 3, name: 'Kartoffeln' });
  });

  it('merges same ingredients for the shopping list', () => {
    const items = aggregate([
      { from: 'A', ingredients: ing('200 g Spaghetti', '1 Zwiebel', 'Salz') },
      { from: 'B', ingredients: ing('0,3 kg Spaghetti', '2 Zwiebeln', 'Salz') },
    ]);
    const spaghetti = items.find((i) => i.key === ingredientKey('Spaghetti'))!;
    expect(spaghetti.amounts).toEqual(['500 g']);
    const zwiebel = items.find((i) => i.name.startsWith('Zwiebel'))!;
    expect(zwiebel.amounts).toEqual(['3']);
    expect(items.filter((i) => i.name === 'Salz')).toHaveLength(1);
  });

  it('categorizes for the supermarket', () => {
    expect(categorize('Olivenöl')).toBe('gewuerze');
    expect(categorize('Kokosmilch')).toBe('konserven');
    expect(categorize('Feta')).toBe('kuehl');
    expect(categorize('Brokkoli')).toBe('gemuese');
    expect(categorize('Basmatireis')).toBe('trocken');
    expect(categorize('Ei')).toBe('kuehl');
    expect(categorize('Gemüsebrühe')).toBe('gewuerze');
  });

  it('matches pantry items', () => {
    expect(matchesPantry('Brokkoli', 'brokkoli')).toBe(true);
    expect(matchesPantry('Zwiebeln', 'Zwiebel')).toBe(true);
    expect(matchesPantry('Cherrytomaten', 'Tomaten')).toBe(true);
    expect(matchesPantry('Feta', 'Brokkoli')).toBe(false);
  });
});

describe('season', () => {
  it('knows Spargel only in spring', () => {
    const r = { ingredients: ing('500 g grüner Spargel'), seasonMonths: undefined };
    expect(recipeSeason(r, 4).strictHit).toBe(true);
    expect(recipeSeason(r, 11).strictMiss).toBe(true);
    expect(recipeSeasonMonths(r)).toEqual([4, 5, 6]);
  });

  it('ignores preserved / derived products', () => {
    expect(findProduce('Kürbiskerne')).toBeUndefined();
    expect(findProduce('Tomatenmark')).toBeUndefined();
    expect(findProduce('Paprikapulver edelsüß')).toBeUndefined();
    expect(findProduce('Hokkaido-Kürbis')?.name).toBe('Kürbis');
    expect(findProduce('Kichererbsen')).toBeUndefined();
  });

  it('respects manual months', () => {
    const r = { ingredients: [], seasonMonths: [12] };
    expect(recipeSeason(r, 12).strictHit).toBe(true);
    expect(recipeSeason(r, 6).strictMiss).toBe(true);
  });

  it('formats month ranges', () => {
    expect(formatMonths([4, 5, 6], MONTHS_SHORT)).toBe('Apr–Jun');
    expect(formatMonths([10, 11, 12, 1, 2], MONTHS_SHORT)).toBe('Okt–Feb');
    expect(formatMonths([3, 4, 5, 6, 9, 10, 11], MONTHS_SHORT)).toBe('Mär–Jun, Sep–Nov');
  });
});

describe('dates', () => {
  it('plans the coming week on the weekend', () => {
    expect(planningWeek(new Date(2026, 9, 18))).toBe('2026-10-19'); // Sunday
    expect(planningWeek(new Date(2026, 9, 17))).toBe('2026-10-19'); // Saturday
    expect(planningWeek(new Date(2026, 9, 14))).toBe('2026-10-12'); // Wednesday
    expect(planningWeek(new Date(2026, 9, 19))).toBe('2026-10-19'); // Monday
    expect(addWeeks('2026-12-28', 1)).toBe('2027-01-04');
    expect(weekMonth('2026-04-27')).toBe(4);
  });
});

function ctxWith(recipes: Recipe[], plans: WeekPlan[] = [], extra: Partial<ShuffleContext> = {}): ShuffleContext {
  return { recipes, plans, week: '2026-10-19', pantry: [], rng: seededRng(7), ...extra };
}

describe('shuffle – Big Batch', () => {
  const carbs: Carb[] = ['kartoffeln', 'reis', 'nudeln', 'bulgur', 'couscous', 'quinoa', 'linsen', 'kartoffeln', 'reis', 'nudeln'];
  const bigs = carbs.map((carb, i) => recipe({ id: `b${i}`, title: `Big ${i}`, carb }));

  it('never repeats a recently cooked Big Batch and never the same carb as last week', () => {
    const plans: WeekPlan[] = [];
    let week = '2026-01-05';
    for (let i = 0; i < 40; i++) {
      const ctx = ctxWith(bigs, plans, { week, rng: seededRng(i + 1) });
      const pick = pickBig(ctx);
      expect(pick).not.toBeNull();
      const last = plans[plans.length - 1];
      if (last) {
        const lastCarb = bigs.find((b) => b.id === last.big)!.carb;
        expect(pick!.recipe.carb).not.toBe(lastCarb);
      }
      // blocked window: 60 % of 10 recipes = 6 weeks
      const recent = plans.slice(-6).map((p) => p.big);
      expect(recent).not.toContain(pick!.recipe.id);
      plans.push({ week, big: pick!.recipe.id });
      week = addWeeks(week, 1);
    }
  });

  it('prefers seasonal recipes and skips strictly out-of-season ones', () => {
    const spargel = recipe({ id: 'sp', title: 'Spargel', carb: 'kartoffeln', ingredients: ing('1 kg Spargel') });
    const plain = recipe({ id: 'pl', title: 'Curry', carb: 'reis', ingredients: ing('200 g Reis') });
    let april = 0;
    for (let i = 0; i < 200; i++) {
      const p = pickBig(ctxWith([spargel, plain], [], { week: '2026-04-20', rng: seededRng(i + 1) }));
      if (p?.recipe.id === 'sp') april++;
    }
    expect(april).toBeGreaterThan(120);
    for (let i = 0; i < 50; i++) {
      const p = pickBig(ctxWith([spargel, plain], [], { week: '2026-11-16', rng: seededRng(i + 1) }));
      expect(p?.recipe.id).toBe('pl');
    }
  });

  it('prefers recipes using pantry items, including flexible vegetables', () => {
    const pfanne = recipe({ id: 'asia', title: 'Asia-Pfanne', flexVeg: { amount: '400 g' }, ingredients: ing('200 g Reis', 'Sojasauce') });
    const others = [1, 2, 3, 4].map((i) => recipe({ id: `o${i}`, title: `O${i}`, carb: 'nudeln' }));
    let hits = 0;
    for (let i = 0; i < 200; i++) {
      const p = pickBig(ctxWith([pfanne, ...others], [], { pantry: ['Brokkoli'], rng: seededRng(i + 1) }));
      if (p?.recipe.id === 'asia') {
        hits++;
        expect(p.reasons.join()).toContain('Brokkoli');
      }
    }
    expect(hits).toBeGreaterThan(70); // > fair share of 40
  });

  it('applies effort and price filters strictly', () => {
    const easy = recipe({ id: 'e', title: 'Easy', effort: 'leicht', price: 1 });
    const hard = recipe({ id: 'h', title: 'Hard', effort: 'aufwendig', price: 5 });
    for (let i = 0; i < 20; i++) {
      expect(pickBig(ctxWith([easy, hard], [], { filters: { maxEffort: 'leicht' }, rng: seededRng(i + 1) }))?.recipe.id).toBe('e');
      expect(pickBig(ctxWith([easy, hard], [], { filters: { maxPrice: 2 }, rng: seededRng(i + 1) }))?.recipe.id).toBe('e');
    }
    expect(pickBig(ctxWith([hard], [], { filters: { maxEffort: 'mittel' } }))).toBeNull();
  });

  it('still suggests something with too few recipes and says why', () => {
    const only = recipe({ id: 'x', title: 'X', carb: 'reis' });
    const pick = pickBig(ctxWith([only], [{ week: '2026-10-12', big: 'x' }]));
    expect(pick?.recipe.id).toBe('x');
    expect(pick?.relaxed).toBeTruthy();
  });
});

describe('shuffle – Small Batch & week', () => {
  it('small batch may repeat but differs in carb from this week’s big batch', () => {
    const big = recipe({ id: 'big', title: 'Big', carb: 'nudeln' });
    const smallPasta = recipe({ id: 'sp', title: 'Pasta', batch: 'small', carb: 'nudeln' });
    const smallRice = recipe({ id: 'sr', title: 'Reis', batch: 'small', carb: 'reis' });
    for (let i = 0; i < 30; i++) {
      const res = shuffleWeek(ctxWith([big, smallPasta, smallRice], [{ week: '2026-10-12', small: 'sr' }], { rng: seededRng(i + 1) }), {
        week: '2026-10-19',
      });
      expect(res.plan.big).toBe('big');
      expect(res.plan.small).toBe('sr');
    }
  });

  it('keeps locked dishes and reshuffles a single slot to something new', () => {
    const bigs = ['kartoffeln', 'reis', 'nudeln', 'linsen'].map((c, i) => recipe({ id: `B${i}`, title: `B${i}`, carb: c as Carb }));
    const smalls = ['kartoffeln', 'reis', 'nudeln'].map((c, i) => recipe({ id: `S${i}`, title: `S${i}`, batch: 'small', carb: c as Carb }));
    const ctx = ctxWith([...bigs, ...smalls]);
    const locked = shuffleWeek(ctx, { week: ctx.week, big: 'B0', small: 'S1', lockBig: true });
    expect(locked.plan.big).toBe('B0');
    expect(locked.plan.small).not.toBe('S1');
    expect(locked.plan.small).not.toBe('S0'); // B0 = Kartoffeln

    const again = shuffleWeek(ctx, { week: ctx.week, big: 'B1', small: 'S0' }, 'big');
    expect(again.plan.small).toBe('S0');
    expect(again.plan.big).not.toBe('B1');
    expect(again.plan.big).not.toBe('B0'); // S0 = Kartoffeln
  });

  it('returns null picks when there are no recipes of a type', () => {
    const res = shuffleWeek(ctxWith([recipe({ title: 'nur big' })]), { week: '2026-10-19' });
    expect(res.picks.big).not.toBeNull();
    expect(res.picks.small).toBeNull();
  });

  it('pickSmall handles empty pool', () => {
    expect(pickSmall(ctxWith([]))).toBeNull();
  });
});

describe('importer', () => {
  it('reads schema.org JSON-LD with @graph, HowToSteps and ImageObject', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'x' },
        {
          '@type': ['Recipe'],
          name: 'Kürbis-Curry &amp; Reis',
          image: [{ '@type': 'ImageObject', url: '/img/curry.jpg', width: 1200 }],
          recipeYield: ['4', '4 Portionen'],
          totalTime: 'PT45M',
          recipeIngredient: ['1 Hokkaido-Kürbis', '200 g Basmatireis', '1 Dose Kokosmilch'],
          recipeInstructions: [
            { '@type': 'HowToStep', text: 'Kürbis würfeln.' },
            { '@type': 'HowToSection', name: 'Reis', itemListElement: [{ '@type': 'HowToStep', text: 'Reis kochen.' }] },
          ],
        },
      ],
    })}</script></head><body></body></html>`;
    const r = parseRecipeHtml(html, 'https://example.com/rezept/1')!;
    expect(r.title).toBe('Kürbis-Curry & Reis');
    expect(r.imageUrl).toBe('https://example.com/img/curry.jpg');
    expect(r.servings).toBe(4);
    expect(r.time).toBe(45);
    expect(r.ingredients.map((i) => i.name)).toEqual(['Hokkaido-Kürbis', 'Basmatireis', 'Kokosmilch']);
    expect(r.steps).toEqual(['Kürbis würfeln.', 'Reis:', 'Reis kochen.']);
    expect(guessCarb(r.ingredients)).toBe('reis');
  });

  it('falls back to Open Graph', () => {
    const r = parseRecipeHtml('<html><head><meta property="og:title" content="Omas Gulasch"><meta property="og:image" content="https://x.de/a.jpg"></head></html>')!;
    expect(r.title).toBe('Omas Gulasch');
    expect(r.imageUrl).toBe('https://x.de/a.jpg');
    expect(r.ingredients).toEqual([]);
  });

  it('parses free text with headings', () => {
    const r = parseRecipeText(`Linsen-Dal
Für 4 Portionen
Zutaten
- 250 g rote Linsen
- 1 Dose Tomaten
Zubereitung
1. Linsen waschen.
2. Alles 20 Minuten köcheln.`);
    expect(r.title).toBe('Linsen-Dal');
    expect(r.servings).toBe(4);
    expect(r.ingredients).toHaveLength(2);
    expect(r.steps).toEqual(['Linsen waschen.', 'Alles 20 Minuten köcheln.']);
    expect(guessCarb(r.ingredients)).toBe('linsen');
  });

  it('parses free text without headings', () => {
    const r = parseRecipeText(`Schnelle Pasta
200 g Spaghetti
1 Knoblauchzehe
Nudeln kochen und mit Knoblauch in Öl schwenken.`);
    expect(r.ingredients.map((i) => i.name)).toEqual(['Spaghetti', 'Knoblauchzehe']);
    expect(r.steps).toHaveLength(1);
  });

  it('parses ISO durations and avoids false rice matches', () => {
    expect(parseDuration('PT1H30M')).toBe(90);
    expect(parseDuration('P0DT0H20M')).toBe(20);
    expect(guessCarb(ing('Preiselbeeren'))).toBe('ohne');
    expect(guessCarb(ing('500 g festkochende Kartoffeln'))).toBe('kartoffeln');
  });
});

describe('fixes from the first walkthrough', () => {
  it('does not mistake Knoblauch for Lauch', () => {
    expect(findProduce('Knoblauch')).toBeUndefined();
    expect(findProduce('Lauch')?.name).toBe('Lauch');
  });

  it('uses plural units', () => {
    const items = aggregate([{ from: 'A', ingredients: ing('3 Zehen Knoblauch', '2 Dosen Mais') }]);
    expect(items.map((i) => i.amounts[0])).toEqual(['3 Zehen', '2 Dosen']);
  });

  it('avoids the same main vegetable in both dishes of a week', () => {
    const kuerbisBig = recipe({ id: 'kb', title: 'Kürbis-Curry', carb: 'reis', ingredients: ing('1 Hokkaido-Kürbis') });
    const kuerbisSmall = recipe({ id: 'ks', title: 'Ofen-Kürbis', batch: 'small', carb: 'bulgur', ingredients: ing('1 Hokkaido-Kürbis') });
    const other = recipe({ id: 'os', title: 'Pasta', batch: 'small', carb: 'nudeln', ingredients: ing('200 g Penne') });
    let same = 0;
    for (let i = 0; i < 200; i++) {
      const res = shuffleWeek(ctxWith([kuerbisBig, kuerbisSmall, other], [], { rng: seededRng(i + 1) }), { week: '2026-10-19' });
      if (res.plan.small === 'ks') same++;
    }
    // season bonus x3 vs. variety penalty x0.25 -> roughly 43 % instead of 75 %
    expect(same).toBeLessThan(110);
    expect(same).toBeGreaterThan(40);
  });
});
