import type { Batch, Carb, Effort, Price } from './types';

export const CARBS: { id: Carb; label: string; main: boolean }[] = [
  { id: 'kartoffeln', label: 'Kartoffeln', main: true },
  { id: 'reis', label: 'Reis', main: true },
  { id: 'nudeln', label: 'Nudeln', main: true },
  { id: 'bulgur', label: 'Bulgur', main: false },
  { id: 'couscous', label: 'Couscous', main: false },
  { id: 'quinoa', label: 'Quinoa', main: false },
  { id: 'linsen', label: 'Linsen', main: false },
  { id: 'ohne', label: 'Ohne', main: false },
];

export const carbLabel = (c: Carb) => CARBS.find((x) => x.id === c)?.label ?? c;

export const EFFORTS: { id: Effort; label: string; level: number }[] = [
  { id: 'leicht', label: 'Leicht', level: 1 },
  { id: 'mittel', label: 'Mittel', level: 2 },
  { id: 'aufwendig', label: 'Aufwendig', level: 3 },
];

export const effortLabel = (e: Effort) => EFFORTS.find((x) => x.id === e)?.label ?? e;
export const effortLevel = (e: Effort) => EFFORTS.find((x) => x.id === e)?.level ?? 2;

export const BATCHES: { id: Batch; label: string; hint: string }[] = [
  { id: 'big', label: 'Big Batch', hint: 'Für die Woche' },
  { id: 'small', label: 'Small Batch', hint: 'Fürs Wochenende' },
];

export const batchLabel = (b: Batch) => (b === 'big' ? 'Big Batch' : 'Small Batch');

export const PRICES: Price[] = [1, 2, 3, 4, 5];
export const priceLabel = (p: Price) => '€'.repeat(p);
export const PRICE_WORDS: Record<Price, string> = {
  1: 'sehr günstig',
  2: 'günstig',
  3: 'mittel',
  4: 'teurer',
  5: 'teuer',
};

export const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
