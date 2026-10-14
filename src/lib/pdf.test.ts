import { describe, expect, it } from 'vitest';
import { itemsToText, splitRecipes, type TextItem } from './pdf';

// Same layout as the cookbook app's export: title, "Zutaten für 4.0 Portionen", list, "Zubereitung", paragraphs
const EXPORT = `Bohnen-Eintopf mit Paprika
Zutaten für 4.0 Portionen
1 Zwiebel
2 Knoblauchzehen
1 Paprika
800 g weiße Bohnen
1 1/2 EL Paprikapulver
750 ml Gemüsebrühe
Petersilie, gehackt, zum Garnieren

Zubereitung
Zwiebel, Knoblauch und Paprika würfeln.

Alles in einem Topf anschwitzen.

Bohnen und Brühe zugeben und 30 Minuten köcheln lassen.`;

describe('PDF import', () => {
  it('reads the cookbook export layout', () => {
    const [r] = splitRecipes(EXPORT);
    expect(r.title).toBe('Bohnen-Eintopf mit Paprika');
    expect(r.servings).toBe(4);
    expect(r.ingredients).toHaveLength(7);
    expect(r.ingredients[4]).toMatchObject({ qty: 1.5, unit: 'EL', name: 'Paprikapulver' });
    expect(r.ingredients[6]).toMatchObject({ name: 'Petersilie', note: 'gehackt, zum Garnieren' });
    expect(r.steps).toEqual([
      'Zwiebel, Knoblauch und Paprika würfeln.',
      'Alles in einem Topf anschwitzen.',
      'Bohnen und Brühe zugeben und 30 Minuten köcheln lassen.',
    ]);
  });

  it('splits a PDF with several recipes', () => {
    const two = `${EXPORT}\n\nReis mit Erbsen\nZutaten für 2 Portionen\n200 g Reis\n150 g Erbsen\nZubereitung\nReis kochen, Erbsen untermischen.`;
    const list = splitRecipes(two);
    expect(list.map((r) => r.title)).toEqual(['Bohnen-Eintopf mit Paprika', 'Reis mit Erbsen']);
    expect(list[1].ingredients).toHaveLength(2);
    expect(list[1].servings).toBe(2);
  });

  it('ignores text above the first recipe title', () => {
    const [r] = splitRecipes(`Meine Kochbuch-App\nExportiert am 14.10.\n\n${EXPORT}`);
    expect(r.title).toBe('Bohnen-Eintopf mit Paprika');
  });

  it('rebuilds lines and paragraphs from pdf.js text items', () => {
    const item = (str: string, x: number, y: number): TextItem => ({ str, transform: [12, 0, 0, 12, x, y], height: 12 });
    const text = itemsToText([
      [
        item('Titel', 50, 800),
        item('Zutaten für ', 50, 780),
        item('2 Portionen', 120, 780),
        item('1 Zwiebel', 50, 765),
        item('Zubereitung', 50, 750),
        item('Schritt eins.', 50, 735),
        item('Schritt zwei.', 50, 700),
      ],
    ]);
    expect(text).toBe('Titel\nZutaten für 2 Portionen\n1 Zwiebel\nZubereitung\nSchritt eins.\n\nSchritt zwei.');
  });
});
