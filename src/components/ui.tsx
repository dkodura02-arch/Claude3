import { useEffect, useState, type ReactNode } from 'react';
import { Leaf, X } from 'lucide-react';
import { batchLabel, carbLabel, effortLabel, effortLevel, MONTHS_SHORT } from '../lib/labels';
import { formatMonths, recipeSeason, recipeSeasonMonths } from '../lib/season';
import { store } from '../lib/store';
import type { Carb, Recipe } from '../lib/types';

export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {title && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Schließen">
              <X size={22} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? 'on' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
          {o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  );
}

export function EffortBadge({ effort }: { effort: Recipe['effort'] }) {
  const level = effortLevel(effort);
  return (
    <span className="badge" title={`Aufwand: ${effortLabel(effort)}`}>
      <Dots level={level} />
      {effortLabel(effort)}
    </span>
  );
}

function Dots({ level }: { level: number }) {
  return (
    <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={3 + i * 6} cy={4} r={2.6} fill="currentColor" opacity={i < level ? 1 : 0.25} />
      ))}
    </svg>
  );
}

export function PriceBadge({ price }: { price: Recipe['price'] }) {
  return (
    <span className="badge price" title={`Preis ${price} von 5`}>
      {'€'.repeat(price)}
      <span className="dim">{'€'.repeat(5 - price)}</span>
    </span>
  );
}

export function SeasonBadge({ recipe, month }: { recipe: Recipe; month: number }) {
  const months = recipeSeasonMonths(recipe);
  if (!months) return null;
  const s = recipeSeason(recipe, month);
  return (
    <span className={`badge ${s.strictHit ? 'season' : ''}`} title="Saison">
      <Leaf size={12} />
      {s.strictHit ? 'Saison' : formatMonths(months, MONTHS_SHORT)}
    </span>
  );
}

export function RecipeBadges({ recipe, month, batch = false }: { recipe: Recipe; month: number; batch?: boolean }) {
  return (
    <div className="badges">
      {batch && <span className={`badge ${recipe.batch}`}>{batchLabel(recipe.batch)}</span>}
      <EffortBadge effort={recipe.effort} />
      <PriceBadge price={recipe.price} />
      {recipe.carb !== 'ohne' && <span className="badge">{carbLabel(recipe.carb)}</span>}
      {recipe.flexVeg && <span className="badge">+ Gemüse</span>}
      <SeasonBadge recipe={recipe} month={month} />
    </div>
  );
}

const CARB_EMOJI: Record<Carb, string> = {
  kartoffeln: '🥔',
  reis: '🍚',
  nudeln: '🍝',
  bulgur: '🌾',
  couscous: '🥗',
  quinoa: '🌱',
  linsen: '🍲',
  ohne: '🥘',
};

const PALETTES: [string, string][] = [
  ['#efe1c6', '#e2c99c'],
  ['#e3ead6', '#c9d8b4'],
  ['#f3dccf', '#e8bfa8'],
  ['#e6e0ef', '#cfc4e0'],
  ['#dde9e9', '#bcd4d3'],
  ['#f2e6c9', '#e6d29a'],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const fallbackCache = new Map<string, string>();

/** Recipe picture with a friendly placeholder; Drive images fall back to loading via the script. */
export function RecipeImage({ recipe }: { recipe: Pick<Recipe, 'id' | 'title' | 'carb' | 'image'> }) {
  const url = recipe.image?.url;
  const driveId = recipe.image?.driveId;
  const [src, setSrc] = useState<string | undefined>(() => (driveId && fallbackCache.get(driveId)) || url);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc((driveId && fallbackCache.get(driveId)) || url);
    setFailed(false);
  }, [url, driveId]);

  const onError = () => {
    if (driveId && !fallbackCache.has(driveId) && store.online) {
      store
        .call<{ mimeType: string; base64: string }>({ op: 'image', id: driveId })
        .then((r) => {
          const data = `data:${r.mimeType};base64,${r.base64}`;
          fallbackCache.set(driveId, data);
          setSrc(data);
        })
        .catch(() => setFailed(true));
    } else {
      setFailed(true);
    }
  };

  if (src && !failed) {
    return <img className="img" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={onError} />;
  }
  const [a, b] = PALETTES[hash(recipe.id || recipe.title) % PALETTES.length];
  return (
    <div className="placeholder" style={{ ['--ph-a' as string]: a, ['--ph-b' as string]: b }}>
      <span>{CARB_EMOJI[recipe.carb] ?? '🍽️'}</span>
    </div>
  );
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return (
    <div className="toast" role="status">
      {message}
    </div>
  );
}
