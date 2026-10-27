import { parseIngredientLines } from './ingredients';
import { store } from './store';
import type { Recipe } from './types';

/**
 * Built-in collection: simple, cheap dishes without meat. Every recipe has a fixed id, so
 * loading the collection on both phones never creates duplicates and deleted ones stay deleted.
 */
type Sample = Omit<Recipe, 'id' | 'createdAt' | 'ingredients' | 'sample'> & { id?: string; ingredients: string };

const SAMPLES: Sample[] = [
  {
    title: 'Kürbis-Kokos-Curry mit Reis',
    batch: 'big',
    slowCooker: true,
    notes: 'Slow Cooker: Zwiebeln, Knoblauch und Ingwer kurz anschwitzen, dann alles außer Reis und Limette 4–5 Std. auf LOW garen. Reis frisch kochen.',
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
    slowCooker: true,
    notes: 'Slow Cooker: Zwiebeln, Knoblauch und Paprika kurz anbraten, mit allen Zutaten außer dem Reis 6–8 Std. auf LOW garen.',
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
    price: 3,
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

const MORE: Sample[] = [
  // ---------- Big Batch ----------
  {
    id: 'start-dal',
    title: 'Rote-Linsen-Dal mit Fladenbrot',
    batch: 'big',
    slowCooker: true,
    notes: 'Slow Cooker: Alles außer Limette und Fladenbrot 5–6 Std. auf LOW garen, dann mit Limettensaft abschmecken.',
    effort: 'leicht',
    price: 1,
    carb: 'linsen',
    servings: 5,
    time: 35,
    ingredients: `300 g rote Linsen
1 Zwiebel
2 Zehen Knoblauch
1 Stück Ingwer (2 cm)
1 Dose gehackte Tomaten
1 Dose Kokosmilch
750 ml Gemüsebrühe
2 TL Currypulver
1 TL Kurkuma
1 Limette
2 Fladenbrote`,
    steps: [
      'Zwiebel, Knoblauch und Ingwer fein hacken und in etwas Öl glasig dünsten.',
      'Currypulver und Kurkuma kurz mitrösten.',
      'Linsen, Tomaten, Kokosmilch und Brühe zugeben und etwa 20 Minuten köcheln, bis die Linsen zerfallen.',
      'Mit Limettensaft und Salz abschmecken, dazu Fladenbrot.',
    ],
  },
  {
    id: 'start-kichererbsen-curry',
    title: 'Kichererbsen-Spinat-Curry mit Reis',
    batch: 'big',
    slowCooker: true,
    notes: 'Slow Cooker: Alles außer Spinat und Reis 4–6 Std. auf LOW garen, den Spinat zum Schluss unterrühren.',
    effort: 'leicht',
    price: 1,
    carb: 'reis',
    servings: 5,
    time: 35,
    ingredients: `2 Dosen Kichererbsen
450 g TK-Blattspinat
1 Zwiebel
2 Zehen Knoblauch
1 Dose Kokosmilch
1 Dose gehackte Tomaten
2 EL gelbe Currypaste
1 TL Garam Masala
400 g Basmatireis`,
    steps: [
      'Reis nach Packungsangabe kochen.',
      'Zwiebel und Knoblauch hacken und in Öl anbraten, Currypaste kurz mitrösten.',
      'Tomaten, Kokosmilch und abgetropfte Kichererbsen zugeben, 10 Minuten köcheln.',
      'Spinat unterrühren und mitgaren, bis er heiß ist. Mit Garam Masala und Salz abschmecken.',
    ],
  },
  {
    id: 'start-kartoffelsuppe',
    title: 'Kartoffelsuppe mit Möhren und Lauch',
    batch: 'big',
    effort: 'leicht',
    price: 1,
    carb: 'kartoffeln',
    servings: 6,
    time: 40,
    ingredients: `1,5 kg mehligkochende Kartoffeln
3 Möhren
1 Stange Lauch
1 Zwiebel
1,5 l Gemüsebrühe
150 ml Sahne
1 TL Majoran
Muskat
1 Bund Petersilie`,
    steps: [
      'Kartoffeln und Möhren schälen und würfeln, Lauch in Ringe und Zwiebel in Würfel schneiden.',
      'Zwiebel und Lauch in etwas Butter andünsten, Kartoffeln und Möhren zugeben.',
      'Mit Brühe auffüllen und 20 Minuten köcheln. Etwa die Hälfte grob pürieren.',
      'Sahne einrühren, mit Majoran, Muskat, Salz und Pfeffer würzen, Petersilie darüber.',
    ],
  },
  {
    id: 'start-linseneintopf',
    title: 'Linseneintopf mit Kartoffeln',
    batch: 'big',
    slowCooker: true,
    notes: 'Slow Cooker: Alle Zutaten außer dem Essig 7–8 Std. auf LOW garen, zum Schluss mit Essig abschmecken.',
    effort: 'leicht',
    price: 1,
    carb: 'linsen',
    servings: 6,
    time: 50,
    ingredients: `300 g Tellerlinsen
500 g Kartoffeln
3 Möhren
1 Stange Lauch
1 Zwiebel
2 EL Tomatenmark
1,5 l Gemüsebrühe
2 Lorbeerblätter
2 EL Essig
200 g Räuchertofu (optional)`,
    steps: [
      'Zwiebel, Möhren und Kartoffeln würfeln, Lauch in Ringe schneiden.',
      'Zwiebel und Tomatenmark in Öl anrösten, Gemüse, Linsen, Brühe und Lorbeer zugeben.',
      '35 Minuten köcheln, bis die Linsen weich sind. Nach Wunsch gewürfelten Räuchertofu mitwärmen.',
      'Mit Essig, Salz und Pfeffer abschmecken – schmeckt am zweiten Tag noch besser.',
    ],
  },
  {
    id: 'start-ratatouille',
    title: 'Ratatouille mit Bulgur',
    batch: 'big',
    effort: 'mittel',
    price: 2,
    carb: 'bulgur',
    servings: 5,
    time: 60,
    ingredients: `2 Zucchini
1 Aubergine
2 Paprikaschoten
1 Zwiebel
3 Zehen Knoblauch
1 Dose stückige Tomaten
2 TL Kräuter der Provence
300 g Bulgur
600 ml Gemüsebrühe
100 g Feta`,
    steps: [
      'Gemüse in mundgerechte Würfel schneiden.',
      'Zwiebel und Knoblauch in Olivenöl anbraten, Aubergine zugeben und kräftig anbraten.',
      'Zucchini und Paprika zugeben, mit Tomaten und Kräutern 25 Minuten schmoren.',
      'Bulgur in der Brühe 10 Minuten quellen lassen. Mit dem Gemüse und zerbröseltem Feta servieren.',
    ],
  },
  {
    id: 'start-gefuellte-paprika',
    title: 'Gefüllte Paprika mit Reis und Feta',
    batch: 'big',
    effort: 'mittel',
    price: 2,
    carb: 'reis',
    servings: 4,
    time: 60,
    ingredients: `6 Paprikaschoten
200 g Reis
200 g Feta
1 Zwiebel
1 Zucchini
500 g passierte Tomaten
1 TL Paprikapulver
1 TL Oregano
100 g geriebener Käse`,
    steps: [
      'Reis knapp gar kochen. Paprika oben aufschneiden und entkernen.',
      'Zwiebel und Zucchini fein würfeln, anbraten und mit Reis, Feta und Gewürzen mischen.',
      'Paprika füllen, in eine Form mit den passierten Tomaten setzen und mit Käse bestreuen.',
      'Bei 180 °C etwa 35 Minuten backen.',
    ],
  },
  {
    id: 'start-shepherds-pie',
    title: "Linsen-Shepherd's-Pie",
    batch: 'big',
    effort: 'mittel',
    price: 2,
    carb: 'kartoffeln',
    servings: 6,
    time: 75,
    ingredients: `1,2 kg mehligkochende Kartoffeln
250 ml Milch
30 g Butter
250 g braune Linsen
2 Möhren
1 Zwiebel
200 g TK-Erbsen
2 EL Tomatenmark
500 ml Gemüsebrühe
1 EL Sojasauce
1 TL Thymian
100 g geriebener Cheddar`,
    steps: [
      'Kartoffeln kochen und mit Milch und Butter zu Püree stampfen.',
      'Zwiebel und Möhren würfeln und anbraten, Tomatenmark kurz mitrösten.',
      'Linsen, Brühe, Sojasauce und Thymian zugeben und 25 Minuten köcheln, zum Schluss die Erbsen.',
      'Linsen in eine Form geben, Püree darauf verteilen, Käse darüber und bei 200 °C 20 Minuten backen.',
    ],
  },
  {
    id: 'start-nudelauflauf',
    title: 'Nudelauflauf mit Brokkoli',
    batch: 'big',
    effort: 'leicht',
    price: 2,
    carb: 'nudeln',
    servings: 5,
    time: 45,
    ingredients: `500 g Penne
1 Brokkoli
200 ml Sahne
300 ml Milch
2 Eier
200 g geriebener Gouda
Muskat`,
    steps: [
      'Penne 3 Minuten kürzer als angegeben kochen, die Brokkoliröschen die letzten 3 Minuten mitgaren.',
      'Sahne, Milch und Eier verquirlen, mit Salz, Pfeffer und Muskat würzen.',
      'Nudeln und Brokkoli in eine Form geben, Guss darüber, mit Käse bestreuen.',
      'Bei 200 °C etwa 25 Minuten goldbraun backen.',
    ],
  },
  {
    id: 'start-minestrone',
    title: 'Minestrone mit weißen Bohnen',
    batch: 'big',
    effort: 'leicht',
    price: 1,
    carb: 'nudeln',
    servings: 6,
    time: 45,
    ingredients: `1 Zwiebel
2 Möhren
2 Stangen Staudensellerie
1 Zucchini
1 Dose weiße Bohnen
1 Dose gehackte Tomaten
1,5 l Gemüsebrühe
150 g Suppennudeln
1 TL Oregano
Parmesan`,
    steps: [
      'Gemüse klein würfeln und in Olivenöl andünsten.',
      'Tomaten, Brühe und Oregano zugeben und 15 Minuten köcheln.',
      'Bohnen und Nudeln zugeben und garen, bis die Nudeln bissfest sind.',
      'Mit Salz und Pfeffer abschmecken und mit Parmesan servieren.',
    ],
  },
  {
    id: 'start-blumenkohl-curry',
    title: 'Blumenkohl-Erbsen-Curry mit Reis',
    batch: 'big',
    effort: 'leicht',
    price: 2,
    carb: 'reis',
    servings: 5,
    time: 40,
    ingredients: `1 Blumenkohl
300 g TK-Erbsen
1 Zwiebel
2 Zehen Knoblauch
1 Stück Ingwer
2 EL Currypaste
1 Dose Kokosmilch
200 ml Gemüsebrühe
400 g Reis
1 Bund Koriander`,
    steps: [
      'Reis kochen. Blumenkohl in kleine Röschen teilen.',
      'Zwiebel, Knoblauch und Ingwer hacken und anbraten, Currypaste mitrösten.',
      'Blumenkohl, Kokosmilch und Brühe zugeben und 12 Minuten köcheln, dann die Erbsen.',
      'Abschmecken und mit Koriander zum Reis servieren.',
    ],
  },
  {
    id: 'start-marokko-couscous',
    title: 'Marokkanische Gemüsepfanne mit Couscous',
    batch: 'big',
    effort: 'leicht',
    price: 2,
    carb: 'couscous',
    servings: 5,
    time: 40,
    flexVeg: { amount: '700 g' },
    ingredients: `1 Dose Kichererbsen
1 Zwiebel
2 Zehen Knoblauch
1 Dose gehackte Tomaten
2 TL Ras el Hanout
300 g Couscous
50 g Rosinen
1 Bund Petersilie
200 g Joghurt`,
    steps: [
      'Gemüse (z. B. Möhren, Zucchini, Paprika, Kürbis) würfeln, Zwiebel und Knoblauch hacken.',
      'Alles in Öl anbraten, Ras el Hanout kurz mitrösten.',
      'Tomaten und Kichererbsen zugeben und 15 Minuten schmoren.',
      'Couscous mit Rosinen in kochendem Salzwasser quellen lassen. Mit Petersilie und Joghurt servieren.',
    ],
  },
  {
    id: 'start-quinoa-bowl',
    title: 'Quinoa-Bowl mit Ofengemüse und Tahini',
    batch: 'big',
    effort: 'leicht',
    price: 3,
    carb: 'quinoa',
    servings: 4,
    time: 40,
    flexVeg: { amount: '800 g' },
    ingredients: `250 g Quinoa
1 Dose Kichererbsen
3 EL Olivenöl
1 TL Paprikapulver
3 EL Tahin
1 Zitrone
1 Zehe Knoblauch
2 Handvoll Blattsalat`,
    steps: [
      'Gemüse und abgetropfte Kichererbsen mit Öl, Paprikapulver und Salz bei 200 °C 25 Minuten rösten.',
      'Quinoa gründlich waschen und in der doppelten Menge Salzwasser 15 Minuten garen.',
      'Tahin mit Zitronensaft, Knoblauch und etwas Wasser cremig rühren.',
      'Alles in Schalen anrichten – hält sich gut in Meal-Prep-Boxen.',
    ],
  },
  {
    id: 'start-kartoffelgulasch',
    title: 'Kartoffelgulasch',
    batch: 'big',
    slowCooker: true,
    notes: 'Slow Cooker: Zwiebeln mit Tomatenmark und Paprikapulver kurz anrösten, dann alles außer Schmand 6 Std. auf LOW garen.',
    effort: 'leicht',
    price: 1,
    carb: 'kartoffeln',
    servings: 5,
    time: 45,
    ingredients: `1,2 kg festkochende Kartoffeln
2 Zwiebeln
2 Paprikaschoten
2 EL Tomatenmark
2 EL Paprikapulver edelsüß
1 l Gemüsebrühe
1 TL Kümmel
1 TL Majoran
150 g Schmand`,
    steps: [
      'Zwiebeln würfeln, Kartoffeln und Paprika in mundgerechte Stücke schneiden.',
      'Zwiebeln in Öl anbraten, Tomatenmark und Paprikapulver kurz mitrösten.',
      'Kartoffeln, Paprika, Brühe, Kümmel und Majoran zugeben und 25 Minuten köcheln.',
      'Abschmecken und mit einem Klecks Schmand servieren.',
    ],
  },
  {
    id: 'start-gruenkohl',
    title: 'Grünkohl-Eintopf mit Räuchertofu',
    batch: 'big',
    slowCooker: true,
    notes: 'Slow Cooker: Alles außer den Haferflocken 6–7 Std. auf LOW garen, zum Schluss binden und abschmecken.',
    effort: 'mittel',
    price: 2,
    carb: 'kartoffeln',
    servings: 4,
    time: 60,
    ingredients: `750 g Grünkohl
800 g Kartoffeln
2 Zwiebeln
200 g Räuchertofu
1 l Gemüsebrühe
1 EL Senf
2 EL Haferflocken
Muskat`,
    steps: [
      'Grünkohl waschen, von den Stielen zupfen und grob hacken. Kartoffeln würfeln.',
      'Zwiebeln und gewürfelten Räuchertofu in Öl anbraten.',
      'Grünkohl, Kartoffeln und Brühe zugeben und 40 Minuten köcheln.',
      'Mit Haferflocken binden und mit Senf, Muskat, Salz und Pfeffer abschmecken.',
    ],
  },
  {
    id: 'start-cannelloni',
    title: 'Spinat-Ricotta-Cannelloni',
    batch: 'big',
    effort: 'mittel',
    price: 2,
    carb: 'nudeln',
    servings: 5,
    time: 60,
    ingredients: `250 g Cannelloni
450 g TK-Blattspinat
250 g Ricotta
1 Ei
2 Zehen Knoblauch
800 g passierte Tomaten
125 g Mozzarella
Muskat`,
    steps: [
      'Spinat auftauen lassen und gut ausdrücken, mit Ricotta, Ei, Knoblauch, Salz und Muskat mischen.',
      'Die Hälfte der Tomaten in eine Auflaufform geben und würzen.',
      'Cannelloni füllen, in die Form legen und mit den übrigen Tomaten und Mozzarella bedecken.',
      'Bei 180 °C etwa 35 Minuten backen.',
    ],
  },
  {
    id: 'start-erbsensuppe',
    title: 'Gelbe Erbsensuppe',
    batch: 'big',
    slowCooker: true,
    notes: 'Slow Cooker: Alles in den Topf geben und 8 Std. auf LOW garen, bis die Erbsen zerfallen.',
    effort: 'leicht',
    price: 1,
    carb: 'linsen',
    servings: 6,
    time: 70,
    ingredients: `500 g gelbe Schälerbsen
3 Möhren
1 Stange Lauch
2 Kartoffeln
1 Zwiebel
2 l Gemüsebrühe
1 TL Majoran
1 TL geräuchertes Paprikapulver`,
    steps: [
      'Gemüse und Kartoffeln würfeln.',
      'Zwiebel in Öl andünsten, Erbsen, Gemüse und Brühe zugeben.',
      'Etwa 50 Minuten köcheln, bis die Erbsen zerfallen, dabei ab und zu umrühren.',
      'Mit Majoran, Paprikapulver, Salz und Pfeffer abschmecken.',
    ],
  },
  {
    id: 'start-gebratener-reis',
    title: 'Gebratener Gemüsereis mit Ei',
    batch: 'big',
    effort: 'leicht',
    price: 1,
    carb: 'reis',
    servings: 4,
    time: 30,
    flexVeg: { amount: '500 g' },
    ingredients: `400 g Reis
4 Eier
3 Frühlingszwiebeln
200 g TK-Erbsen
4 EL Sojasauce
1 Zehe Knoblauch
1 Stück Ingwer`,
    steps: [
      'Reis am besten schon am Vortag kochen und abkühlen lassen.',
      'Gemüse klein schneiden und im Wok mit Knoblauch und Ingwer scharf anbraten.',
      'Reis und Erbsen zugeben und mitbraten, Eier an den Rand schlagen und stocken lassen.',
      'Alles mit Sojasauce mischen und mit Frühlingszwiebeln bestreuen.',
    ],
  },

  // ---------- Small Batch ----------
  {
    id: 'start-bratkartoffeln',
    title: 'Bratkartoffeln mit Spiegelei und Gurkensalat',
    batch: 'small',
    effort: 'leicht',
    price: 1,
    carb: 'kartoffeln',
    servings: 2,
    time: 35,
    ingredients: `600 g festkochende Kartoffeln
1 Zwiebel
4 Eier
1 Gurke
150 g Joghurt
½ Bund Dill
2 EL Butterschmalz`,
    steps: [
      'Kartoffeln (am besten vom Vortag) in Scheiben schneiden und in Butterschmalz goldbraun braten, die Zwiebel zum Schluss mitbraten.',
      'Gurke hobeln und mit Joghurt, Dill, Salz und Pfeffer mischen.',
      'Spiegeleier braten und alles zusammen servieren.',
    ],
  },
  {
    id: 'start-kartoffelpuffer',
    title: 'Kartoffelpuffer mit Apfelmus',
    batch: 'small',
    effort: 'mittel',
    price: 1,
    carb: 'kartoffeln',
    servings: 2,
    time: 40,
    ingredients: `800 g mehligkochende Kartoffeln
1 Zwiebel
2 Eier
2 EL Mehl
1 Glas Apfelmus`,
    steps: [
      'Kartoffeln und Zwiebel fein reiben und in einem Tuch gut ausdrücken.',
      'Mit Eiern, Mehl und Salz verrühren.',
      'Kleine Puffer in reichlich Öl von beiden Seiten knusprig braten.',
      'Mit Apfelmus servieren.',
    ],
  },
  {
    id: 'start-pfannkuchen',
    title: 'Herzhafte Pfannkuchen mit Spinat und Käse',
    batch: 'small',
    effort: 'leicht',
    price: 1,
    carb: 'ohne',
    servings: 2,
    time: 30,
    ingredients: `200 g Mehl
3 Eier
400 ml Milch
200 g Babyspinat
1 Zehe Knoblauch
100 g geriebener Gouda`,
    steps: [
      'Mehl, Eier, Milch und eine Prise Salz glatt rühren und 10 Minuten quellen lassen.',
      'Spinat mit Knoblauch in einer Pfanne zusammenfallen lassen.',
      'Dünne Pfannkuchen backen, mit Spinat und Käse füllen und zusammenklappen.',
    ],
  },
  {
    id: 'start-aglio-olio',
    title: 'Spaghetti aglio e olio',
    batch: 'small',
    effort: 'leicht',
    price: 1,
    carb: 'nudeln',
    servings: 2,
    time: 15,
    ingredients: `250 g Spaghetti
4 Zehen Knoblauch
6 EL Olivenöl
1 getrocknete Chilischote
½ Bund Petersilie
Parmesan`,
    steps: [
      'Spaghetti in Salzwasser bissfest kochen.',
      'Knoblauch in dünne Scheiben schneiden und mit der zerbröselten Chili im Öl sanft goldgelb werden lassen.',
      'Nudeln mit etwas Nudelwasser in die Pfanne geben, Petersilie unterheben, mit Parmesan servieren.',
    ],
  },
  {
    id: 'start-kaesespaetzle',
    title: 'Käsespätzle mit Röstzwiebeln',
    batch: 'small',
    effort: 'mittel',
    price: 2,
    carb: 'nudeln',
    servings: 2,
    time: 30,
    ingredients: `400 g Spätzle (Kühlregal)
150 g Bergkäse
2 Zwiebeln
20 g Butter
½ Bund Schnittlauch`,
    steps: [
      'Zwiebeln in Ringe schneiden und in Butter langsam goldbraun braten.',
      'Spätzle in der Pfanne erhitzen und den geriebenen Käse schichtweise unterheben, bis er schmilzt.',
      'Mit Röstzwiebeln und Schnittlauch servieren, dazu passt ein grüner Salat.',
    ],
  },
  {
    id: 'start-flammkuchen',
    title: 'Flammkuchen mit Lauch und Zwiebeln',
    batch: 'small',
    effort: 'leicht',
    price: 2,
    carb: 'ohne',
    servings: 2,
    time: 30,
    ingredients: `1 Rolle Flammkuchenteig
200 g Schmand
1 Stange Lauch
1 rote Zwiebel
80 g Bergkäse`,
    steps: [
      'Ofen auf 220 °C vorheizen, Teig auf dem Blech ausrollen.',
      'Schmand mit Salz und Pfeffer verrühren und dünn aufstreichen.',
      'Lauch in feine Ringe, Zwiebel in Streifen schneiden, darauf verteilen, Käse darüber reiben.',
      'Etwa 12 Minuten knusprig backen.',
    ],
  },
  {
    id: 'start-pilzrisotto',
    title: 'Champignon-Risotto',
    batch: 'small',
    effort: 'mittel',
    price: 2,
    carb: 'reis',
    servings: 2,
    time: 40,
    ingredients: `200 g Risottoreis
300 g Champignons
1 Zwiebel
800 ml Gemüsebrühe
50 g Parmesan
20 g Butter
½ Bund Petersilie`,
    steps: [
      'Champignons in Scheiben schneiden und kräftig anbraten, beiseitestellen.',
      'Zwiebel fein würfeln und in Butter glasig dünsten, Reis kurz mitdünsten.',
      'Nach und nach heiße Brühe angießen und unter Rühren etwa 20 Minuten garen.',
      'Pilze, Parmesan und Petersilie unterrühren und abschmecken.',
    ],
  },
  {
    id: 'start-spargel-klassisch',
    title: 'Spargel mit Kartoffeln und Hollandaise',
    batch: 'small',
    effort: 'leicht',
    price: 4,
    carb: 'kartoffeln',
    servings: 2,
    time: 35,
    ingredients: `1 kg weißer Spargel
600 g kleine Kartoffeln
1 Packung Sauce Hollandaise
20 g Butter
1 TL Zucker
½ Bund Petersilie`,
    steps: [
      'Kartoffeln in Salzwasser garen.',
      'Spargel schälen, holzige Enden abschneiden und in Wasser mit Salz, Zucker und Butter 12–15 Minuten garen.',
      'Hollandaise erwärmen und alles mit Petersilie servieren.',
    ],
  },
  {
    id: 'start-baerlauch-pasta',
    title: 'Bärlauch-Pasta mit Zitrone',
    batch: 'small',
    effort: 'leicht',
    price: 2,
    carb: 'nudeln',
    servings: 2,
    time: 20,
    ingredients: `250 g Spaghetti
1 Bund Bärlauch
50 g Parmesan
30 g Sonnenblumenkerne
6 EL Olivenöl
1 Zitrone`,
    steps: [
      'Spaghetti kochen. Sonnenblumenkerne ohne Fett rösten.',
      'Bärlauch mit Kernen, Parmesan, Öl und etwas Zitronenabrieb zu Pesto pürieren.',
      'Nudeln mit Pesto und einem Schuss Nudelwasser mischen, mit Zitronensaft abschmecken.',
    ],
  },
  {
    id: 'start-quinoa-salat',
    title: 'Quinoa-Salat mit Bohnen und Mais',
    batch: 'small',
    effort: 'leicht',
    price: 2,
    carb: 'quinoa',
    servings: 2,
    time: 25,
    ingredients: `150 g Quinoa
1 Dose Kidneybohnen
1 kleine Dose Mais
1 Paprikaschote
1 rote Zwiebel
1 Avocado
1 Limette
½ Bund Koriander`,
    steps: [
      'Quinoa waschen und in Salzwasser 15 Minuten garen, abkühlen lassen.',
      'Paprika, Zwiebel und Avocado würfeln, Bohnen und Mais abspülen.',
      'Alles mit Limettensaft, Öl, Salz und Koriander mischen.',
    ],
  },
  {
    id: 'start-linsensalat',
    title: 'Lauwarmer Linsensalat mit Feta',
    batch: 'small',
    effort: 'leicht',
    price: 1,
    carb: 'linsen',
    servings: 2,
    time: 30,
    ingredients: `200 g Tellerlinsen
1 rote Zwiebel
2 Möhren
100 g Feta
2 EL Essig
3 EL Olivenöl
1 TL Senf
1 TL Honig
½ Bund Petersilie`,
    steps: [
      'Linsen in Wasser ohne Salz etwa 20 Minuten bissfest garen.',
      'Möhren und Zwiebel fein würfeln, aus Essig, Öl, Senf und Honig ein Dressing rühren.',
      'Warme Linsen mit Gemüse und Dressing mischen, Feta und Petersilie darüber.',
    ],
  },
  {
    id: 'start-gnocchi-pfanne',
    title: 'Gnocchi-Pfanne mit Tomaten und Mozzarella',
    batch: 'small',
    effort: 'leicht',
    price: 2,
    carb: 'nudeln',
    servings: 2,
    time: 20,
    ingredients: `500 g Gnocchi (Kühlregal)
250 g Cherrytomaten
125 g Mozzarella
1 Zehe Knoblauch
2 EL Olivenöl
½ Bund Basilikum`,
    steps: [
      'Gnocchi in Olivenöl goldbraun anbraten.',
      'Tomaten halbieren und mit dem Knoblauch kurz mitbraten.',
      'Mozzarella zerzupfen und darauf schmelzen lassen, mit Basilikum servieren.',
    ],
  },
  {
    id: 'start-bohnen-wraps',
    title: 'Bohnen-Wraps mit Salsa',
    batch: 'small',
    effort: 'leicht',
    price: 1,
    carb: 'ohne',
    servings: 2,
    time: 20,
    flexVeg: { amount: '200 g' },
    ingredients: `4 Weizentortillas
1 Dose Kidneybohnen
1 kleine Dose Mais
1 TL Kreuzkümmel
150 g Schmand
100 g geriebener Käse
2 Tomaten
½ Eisbergsalat`,
    steps: [
      'Bohnen mit Mais und Kreuzkümmel in der Pfanne erwärmen und leicht zerdrücken.',
      'Tomaten würfeln und mit Salz und etwas Limette zu einer Salsa mischen, Salat in Streifen schneiden.',
      'Tortillas erwärmen und mit Bohnen, Gemüse, Salsa, Schmand und Käse füllen.',
    ],
  },
  {
    id: 'start-zucchinipuffer',
    title: 'Zucchini-Puffer mit Joghurt-Dip',
    batch: 'small',
    effort: 'leicht',
    price: 1,
    carb: 'ohne',
    servings: 2,
    time: 30,
    ingredients: `2 Zucchini
1 Ei
4 EL Mehl
50 g Feta
150 g Joghurt
1 Zehe Knoblauch
½ Bund Minze`,
    steps: [
      'Zucchini grob reiben, salzen, 10 Minuten ziehen lassen und gut ausdrücken.',
      'Mit Ei, Mehl und zerbröseltem Feta mischen und kleine Puffer goldbraun braten.',
      'Joghurt mit Knoblauch, Minze und Salz verrühren und dazu servieren.',
    ],
  },
  {
    id: 'start-rahm-champignons',
    title: 'Rahm-Champignons mit Bandnudeln',
    batch: 'small',
    effort: 'leicht',
    price: 1,
    carb: 'nudeln',
    servings: 2,
    time: 25,
    ingredients: `250 g Bandnudeln
400 g Champignons
1 Zwiebel
200 ml Sahne
100 ml Gemüsebrühe
½ Bund Petersilie`,
    steps: [
      'Bandnudeln kochen.',
      'Champignons in Scheiben schneiden und kräftig anbraten, Zwiebel mitbraten.',
      'Mit Sahne und Brühe ablöschen und kurz einköcheln, mit Salz, Pfeffer und Petersilie abschmecken.',
    ],
  },
  {
    id: 'start-tomatensuppe',
    title: 'Tomatensuppe mit Käse-Toast',
    batch: 'small',
    effort: 'leicht',
    price: 1,
    carb: 'ohne',
    servings: 2,
    time: 30,
    ingredients: `1 Zwiebel
1 Zehe Knoblauch
800 g gehackte Tomaten (Dose)
400 ml Gemüsebrühe
100 ml Sahne
1 TL Zucker
4 Scheiben Toastbrot
4 Scheiben Gouda
½ Bund Basilikum`,
    steps: [
      'Zwiebel und Knoblauch andünsten, Tomaten und Brühe zugeben und 15 Minuten köcheln.',
      'Fein pürieren, Sahne einrühren und mit Zucker, Salz und Pfeffer abschmecken.',
      'Toast mit Käse belegen, zusammenklappen und in der Pfanne von beiden Seiten knusprig braten.',
    ],
  },
  {
    id: 'start-bulgur-pilaw',
    title: 'Bulgur-Pilaw mit Zucchini und Joghurt',
    batch: 'small',
    effort: 'leicht',
    price: 1,
    carb: 'bulgur',
    servings: 2,
    time: 30,
    ingredients: `150 g Bulgur
1 Zucchini
1 Zwiebel
1 EL Tomatenmark
1 TL Paprikapulver
300 ml Gemüsebrühe
150 g Joghurt
½ Bund Minze`,
    steps: [
      'Zwiebel und Zucchini würfeln und in Olivenöl anbraten.',
      'Tomatenmark und Paprikapulver kurz mitrösten, Bulgur und Brühe zugeben.',
      'Zugedeckt bei kleiner Hitze 12 Minuten quellen lassen.',
      'Mit Joghurt und gehackter Minze servieren.',
    ],
  },
];

let cache: Recipe[] | undefined;

export function starterRecipes(): Recipe[] {
  if (cache) return cache;
  const now = Date.now();
  const all = [...SAMPLES.map((s, i) => ({ ...s, id: `sample-${i + 1}` })), ...MORE];
  cache = all.map((s, i) => ({
    ...s,
    id: s.id!,
    createdAt: now - i,
    sample: true,
    ingredients: parseIngredientLines(s.ingredients),
  }));
  return cache;
}

/** Recipes from the collection that are not there yet. Deleted ones only count with includeDeleted. */
function missingStarter(includeDeleted: boolean): Recipe[] {
  return starterRecipes().filter((r) => (includeDeleted ? !store.get('recipes', r.id) : !store.known('recipes', r.id)));
}

export function missingStarterCount({ includeDeleted = false } = {}): number {
  return missingStarter(includeDeleted).length;
}

export function addStarterRecipes({ includeDeleted = false } = {}): number {
  const list = missingStarter(includeDeleted);
  store.batch(() => list.forEach((r) => store.put('recipes', r.id, r)));
  return list.length;
}

/**
 * Collection recipes stored before the slow-cooker flag existed get it (plus the short
 * instructions) afterwards. Recipes where it was switched off on purpose (false) stay as they are.
 */
export function updateStoredStarterRecipes(): number {
  const updates: Recipe[] = [];
  for (const s of starterRecipes()) {
    if (!s.slowCooker) continue;
    const r = store.get('recipes', s.id);
    if (!r || !r.sample || r.slowCooker !== undefined) continue;
    updates.push({
      ...r,
      slowCooker: true,
      notes: r.notes ?? s.notes,
      carb: r.carb === 'ohne' && s.carb === 'linsen' ? 'linsen' : r.carb,
    });
  }
  if (updates.length) store.batch(() => updates.forEach((u) => store.put('recipes', u.id, u)));
  return updates.length;
}
