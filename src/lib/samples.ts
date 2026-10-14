import { parseIngredientLines } from './ingredients';
import type { Recipe } from './types';

type Sample = Omit<Recipe, 'id' | 'createdAt' | 'ingredients' | 'sample'> & { ingredients: string };

const SAMPLES: Sample[] = [
  {
    title: 'Kürbis-Kokos-Curry mit Reis',
    batch: 'big',
    effort: 'mittel',
    price: 2,
    carb: 'reis',
    servings: 5,
    time: 45,
    ingredients: `1 Hokkaido-Kürbis (ca. 1 kg)
2 Zwiebeln
2 Zehen Knoblauch
1 Stück Ingwer (3 cm)
2 EL rote Currypaste
2 Dosen Kokosmilch
1 Dose Kichererbsen
400 g Basmatireis
1 Limette
Salz`,
    steps: [
      'Kürbis entkernen und würfeln, Zwiebeln, Knoblauch und Ingwer fein hacken.',
      'Zwiebeln, Knoblauch und Ingwer in Öl anschwitzen, Currypaste kurz mitrösten.',
      'Kürbis, Kokosmilch und abgetropfte Kichererbsen zugeben und 20 Minuten köcheln.',
      'Währenddessen den Reis kochen. Curry mit Limettensaft und Salz abschmecken.',
    ],
  },
  {
    title: 'Linsen-Bolognese',
    batch: 'big',
    effort: 'leicht',
    price: 1,
    carb: 'nudeln',
    servings: 6,
    time: 40,
    ingredients: `250 g rote Linsen
2 Zwiebeln
2 Möhren
2 Dosen gehackte Tomaten
2 EL Tomatenmark
500 ml Gemüsebrühe
1 TL Oregano
600 g Spaghetti
Parmesan`,
    steps: [
      'Zwiebeln und Möhren fein würfeln und in Olivenöl anbraten.',
      'Tomatenmark kurz mitrösten, Linsen, Tomaten und Brühe zugeben.',
      '25 Minuten köcheln lassen, mit Oregano, Salz und Pfeffer würzen.',
      'Spaghetti kochen und mit der Sauce und Parmesan servieren.',
    ],
  },
  {
    title: 'Ofenkartoffeln mit Kräuterquark und Ofengemüse',
    batch: 'big',
    effort: 'leicht',
    price: 1,
    carb: 'kartoffeln',
    servings: 4,
    time: 50,
    flexVeg: { amount: '800 g' },
    ingredients: `1,5 kg Kartoffeln
2 rote Zwiebeln
500 g Magerquark
150 g Joghurt
1 Bund Schnittlauch
1 Bund Petersilie
4 EL Olivenöl
Salz und Pfeffer`,
    steps: [
      'Kartoffeln halbieren, Gemüse in mundgerechte Stücke schneiden.',
      'Alles mit Öl, Salz und Pfeffer mischen und bei 200 °C ca. 35 Minuten backen.',
      'Quark mit Joghurt und gehackten Kräutern verrühren und abschmecken.',
    ],
    notes: 'Gemüse nach Saison: im Herbst Kürbis und Rote Bete, im Sommer Zucchini und Paprika.',
  },
  {
    title: 'Chili sin Carne',
    batch: 'big',
    effort: 'mittel',
    price: 2,
    carb: 'reis',
    servings: 6,
    time: 60,
    ingredients: `2 Zwiebeln
3 Zehen Knoblauch
2 Paprikaschoten
2 Dosen Kidneybohnen
1 Dose Mais
2 Dosen gehackte Tomaten
150 g Sojagranulat
2 TL Kreuzkümmel
1 TL Chiliflocken
400 g Reis`,
    steps: [
      'Sojagranulat in heißer Brühe einweichen.',
      'Zwiebeln, Knoblauch und Paprika anbraten, Granulat zugeben und kräftig anrösten.',
      'Tomaten, Bohnen, Mais und Gewürze zugeben und 30 Minuten köcheln.',
      'Mit Reis servieren.',
    ],
  },
  {
    title: 'Spargel-Kartoffel-Gratin',
    batch: 'big',
    effort: 'mittel',
    price: 4,
    carb: 'kartoffeln',
    servings: 4,
    time: 70,
    ingredients: `1 kg weißer Spargel
800 g festkochende Kartoffeln
200 ml Sahne
200 ml Milch
150 g Bergkäse
1 Bund Bärlauch
Muskat`,
    steps: [
      'Spargel schälen und in Stücke schneiden, Kartoffeln in dünne Scheiben hobeln.',
      'Sahne und Milch mit Salz, Pfeffer und Muskat würzen, Bärlauch fein hacken.',
      'Alles in eine Form schichten, mit Käse bestreuen und bei 180 °C 45 Minuten backen.',
    ],
  },
  {
    title: 'Gemüse-Lasagne',
    batch: 'big',
    effort: 'aufwendig',
    price: 3,
    carb: 'nudeln',
    servings: 6,
    time: 100,
    ingredients: `12 Lasagneplatten
2 Zucchini
1 Aubergine
1 Paprikaschote
2 Dosen gehackte Tomaten
50 g Butter
50 g Mehl
750 ml Milch
200 g Mozzarella`,
    steps: [
      'Gemüse würfeln und anbraten, mit Tomaten 15 Minuten zu einer Sauce köcheln.',
      'Aus Butter, Mehl und Milch eine Béchamel kochen.',
      'Abwechselnd Platten, Gemüsesauce und Béchamel schichten, mit Mozzarella abschließen.',
      'Bei 180 °C 40 Minuten backen.',
    ],
  },
  {
    title: 'Asia-Pfanne mit Erdnusssauce',
    batch: 'small',
    effort: 'leicht',
    price: 2,
    carb: 'reis',
    servings: 2,
    time: 25,
    flexVeg: { amount: '400 g' },
    ingredients: `150 g Jasminreis
200 g Tofu
3 EL Erdnussbutter
3 EL Sojasauce
1 EL Limettensaft
1 Zehe Knoblauch
1 Stück Ingwer`,
    steps: [
      'Reis kochen. Tofu würfeln und knusprig anbraten.',
      'Gemüse in Streifen schneiden und im Wok scharf anbraten.',
      'Erdnussbutter, Sojasauce, Limette, Knoblauch und Ingwer mit etwas Wasser verrühren.',
      'Alles zusammen kurz schwenken und mit Reis servieren.',
    ],
  },
  {
    title: 'Shakshuka mit Feta',
    batch: 'small',
    effort: 'leicht',
    price: 1,
    carb: 'ohne',
    servings: 2,
    time: 25,
    ingredients: `1 Zwiebel
1 rote Paprikaschote
1 Dose gehackte Tomaten
4 Eier
100 g Feta
1 TL Kreuzkümmel
Fladenbrot`,
    steps: [
      'Zwiebel und Paprika anbraten, Tomaten und Gewürze zugeben, 10 Minuten köcheln.',
      'Mulden formen, Eier hineinschlagen und zugedeckt stocken lassen.',
      'Mit Feta bestreuen und mit Fladenbrot servieren.',
    ],
  },
  {
    title: 'Pasta mit Spinat und Feta',
    batch: 'small',
    effort: 'leicht',
    price: 1,
    carb: 'nudeln',
    servings: 2,
    time: 20,
    ingredients: `250 g Penne
200 g Babyspinat
150 g Feta
1 Zehe Knoblauch
100 g Cherrytomaten
2 EL Olivenöl`,
    steps: [
      'Penne kochen.',
      'Knoblauch und Tomaten in Öl anbraten, Spinat zusammenfallen lassen.',
      'Nudeln untermischen und Feta darüberbröseln.',
    ],
  },
  {
    title: 'Couscous-Salat mit Halloumi',
    batch: 'small',
    effort: 'leicht',
    price: 2,
    carb: 'couscous',
    servings: 2,
    time: 20,
    ingredients: `150 g Couscous
1 Gurke
200 g Cherrytomaten
1 Bund Minze
1 Zitrone
250 g Halloumi`,
    steps: [
      'Couscous mit kochendem Wasser übergießen und 5 Minuten quellen lassen.',
      'Gurke und Tomaten würfeln, Minze hacken, alles mit Zitrone und Öl mischen.',
      'Halloumi in Scheiben braten und auf dem Salat anrichten.',
    ],
  },
  {
    title: 'Ofen-Kürbis mit Bulgur und Feta',
    batch: 'small',
    effort: 'leicht',
    price: 2,
    carb: 'bulgur',
    servings: 2,
    time: 35,
    ingredients: `½ Hokkaido-Kürbis
150 g Bulgur
100 g Feta
1 Granatapfel
2 EL Honig
1 TL Zimt`,
    steps: [
      'Kürbis in Spalten schneiden, mit Öl, Honig und Zimt bei 200 °C 25 Minuten rösten.',
      'Bulgur in Brühe garen.',
      'Mit Kürbis, Feta und Granatapfelkernen anrichten.',
    ],
  },
];

export function sampleRecipes(): Recipe[] {
  const now = Date.now();
  return SAMPLES.map((s, i) => ({
    ...s,
    id: `sample-${i + 1}`,
    createdAt: now - i,
    sample: true,
    ingredients: parseIngredientLines(s.ingredients),
  }));
}
