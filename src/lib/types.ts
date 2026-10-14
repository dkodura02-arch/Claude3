export type Batch = 'big' | 'small';
export type Effort = 'leicht' | 'mittel' | 'aufwendig';
export type Price = 1 | 2 | 3 | 4 | 5;

export type Carb =
  | 'kartoffeln'
  | 'reis'
  | 'nudeln'
  | 'bulgur'
  | 'couscous'
  | 'quinoa'
  | 'linsen'
  | 'ohne';

export interface Ingredient {
  /** Original line as entered or imported, e.g. "200 g Spaghetti" */
  text: string;
  qty?: number;
  unit?: string;
  /** Ingredient name without quantity, unit and notes, e.g. "Spaghetti" */
  name: string;
  note?: string;
}

export interface RecipeImage {
  url: string;
  /** Google Drive file id when the image lives in the household Drive */
  driveId?: string;
}

export interface Recipe {
  id: string;
  title: string;
  image?: RecipeImage;
  sourceUrl?: string;
  servings?: number;
  /** Total time in minutes */
  time?: number;
  batch: Batch;
  effort: Effort;
  price: Price;
  carb: Carb;
  flexVeg?: { amount?: string };
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
  /** Manually chosen months (1-12). Empty/undefined = detect from ingredients. */
  seasonMonths?: number[];
  /** Part of the built-in vegetarian collection */
  sample?: boolean;
  /** Favourites come up twice as often when shuffling */
  favorite?: boolean;
  createdAt: number;
}

export interface WeekPlan {
  /** Monday of the week, YYYY-MM-DD */
  week: string;
  big?: string;
  small?: string;
  lockBig?: boolean;
  lockSmall?: boolean;
}

export interface PantryItem {
  name: string;
}

export interface ShopCheck {
  checked: boolean;
}

export interface ShopItem {
  text: string;
  checked: boolean;
  createdAt: number;
}

export interface CollectionTypes {
  recipes: Recipe;
  plans: WeekPlan;
  pantry: PantryItem;
  shopcheck: ShopCheck;
  shopitem: ShopItem;
}

export type Collection = keyof CollectionTypes;

export interface Doc<T = unknown> {
  coll: Collection;
  id: string;
  data: T | null;
  updatedAt: number;
  deleted?: boolean;
  rev?: number;
}
