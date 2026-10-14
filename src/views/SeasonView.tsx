import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { navigate } from '../AppState';
import { RecipeBadges, RecipeImage } from '../components/ui';
import { useCollection } from '../lib/hooks';
import { MONTHS } from '../lib/labels';
import { PRODUCE, recipeSeason, seasonFactor, type Produce } from '../lib/season';

const prev = (m: number) => ((m + 10) % 12) + 1;
const next = (m: number) => (m % 12) + 1;

function tag(p: Produce, month: number): { text: string; last?: boolean } | null {
  if (!p.months.includes(month) || p.months.length === 12) return null;
  if (!p.months.includes(prev(month))) return { text: 'Neu' };
  if (!p.months.includes(next(month))) return { text: 'Letzte Chance', last: true };
  return null;
}

export function SeasonView() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const recipes = useCollection('recipes');

  const inSeason = PRODUCE.filter((p) => p.months.includes(month));
  const veg = inSeason.filter((p) => p.kind !== 'obst');
  const fruit = inSeason.filter((p) => p.kind === 'obst');

  const matching = useMemo(
    () =>
      recipes
        .map((r) => ({ r, s: recipeSeason(r, month) }))
        .filter(({ s }) => !s.strictMiss && (s.strictHit || s.hits.length > 0))
        .sort((a, b) => seasonFactor(b.s) - seasonFactor(a.s))
        .slice(0, 12),
    [recipes, month],
  );

  return (
    <div className="page">
      <div className="month-switch">
        <button className="icon-btn solid" onClick={() => setMonth(prev(month))} aria-label="Vorheriger Monat">
          <ChevronLeft size={20} />
        </button>
        <strong>{MONTHS[month - 1]}</strong>
        <button className="icon-btn solid" onClick={() => setMonth(next(month))} aria-label="Nächster Monat">
          <ChevronRight size={20} />
        </button>
      </div>

      <h3 className="section-title">Gemüse & Pilze</h3>
      <ProduceGrid items={veg} month={month} />

      {fruit.length > 0 && (
        <>
          <h3 className="section-title">Obst</h3>
          <ProduceGrid items={fruit} month={month} />
        </>
      )}

      <h3 className="section-title">Eure Rezepte, die jetzt passen</h3>
      {matching.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>
          Noch keine Rezepte mit Saisonzutaten für {MONTHS[month - 1]}.
        </p>
      ) : (
        <div className="stack">
          {matching.map(({ r, s }) => (
            <button key={r.id} className="list-row" onClick={() => navigate({ name: 'rezept', id: r.id })}>
              <div className="thumb">
                <RecipeImage recipe={r} />
              </div>
              <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                <strong>{r.title}</strong>
                <span className="tiny muted">{s.manual ? 'Saisonrezept' : s.hits.map((p) => p.name).join(', ')}</span>
                <RecipeBadges recipe={r} month={month} batch />
              </div>
            </button>
          ))}
        </div>
      )}
      <p className="tiny muted" style={{ margin: 0 }}>
        Saisonkalender für Deutschland (Freiland und Lagerware). Ganzjährige Zutaten wie Kartoffeln, Möhren, Zwiebeln oder Äpfel sind nicht aufgeführt.
      </p>
    </div>
  );
}

function ProduceGrid({ items, month }: { items: Produce[]; month: number }) {
  const sorted = [...items].sort((a, b) => Number(!!b.strict) - Number(!!a.strict) || a.name.localeCompare(b.name, 'de'));
  return (
    <div className="produce-grid">
      {sorted.map((p) => {
        const t = tag(p, month);
        return (
          <div key={p.name} className="produce">
            <span className="emo">{p.emoji}</span>
            <span className="name">{p.name}</span>
            {t ? <span className={`tag ${t.last ? 'last' : ''}`}>{t.text}</span> : p.strict ? <span className="tag">Hochsaison</span> : null}
          </div>
        );
      })}
    </div>
  );
}
