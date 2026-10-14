import { ArrowLeft, CalendarPlus, ExternalLink, Heart, Pencil, Trash2 } from 'lucide-react';
import { navigate, useApp } from '../AppState';
import { RecipeBadges, RecipeImage } from '../components/ui';
import { isoWeekNumber, weekMonth, weeksBetween } from '../lib/dates';
import { useCollection, useDoc } from '../lib/hooks';
import { formatQty } from '../lib/ingredients';
import { MONTHS_SHORT } from '../lib/labels';
import { formatMonths, produceInSeason, recipeSeason, recipeSeasonMonths } from '../lib/season';
import { isVegetable } from '../lib/shuffle';
import { store } from '../lib/store';
import type { Recipe } from '../lib/types';

export function RecipeDetail({ id }: { id: string }) {
  const { week, showToast } = useApp();
  const recipe = useDoc('recipes', id);
  const plans = useCollection('plans');
  const pantry = useCollection('pantry');
  const month = weekMonth(week);

  if (!recipe) {
    return (
      <div className="page">
        <div className="empty">
          <p>Rezept nicht gefunden.</p>
          <button className="btn" onClick={() => navigate({ name: 'rezepte' })}>
            Zu den Rezepten
          </button>
        </div>
      </div>
    );
  }

  const cookedWeeks = plans
    .filter((p) => p.big === id || p.small === id)
    .map((p) => p.week)
    .sort()
    .reverse();
  const lastPast = cookedWeeks.find((w) => w <= week);
  const season = recipeSeason(recipe, month);
  const seasonMonths = recipeSeasonMonths(recipe);
  const strictNames = [...season.hits, ...season.misses].filter((p) => p.strict).map((p) => p.name);

  const planIt = () => {
    const plan = plans.find((p) => p.week === week) ?? { week };
    store.put('plans', week, { ...plan, [recipe.batch]: recipe.id });
    showToast(`Für KW ${isoWeekNumber(week)} eingeplant`);
  };

  const remove = () => {
    if (!confirm(`„${recipe.title}“ wirklich löschen?`)) return;
    store.trashImage(recipe.image?.driveId);
    store.remove('recipes', recipe.id);
    navigate({ name: 'rezepte' }, true);
    showToast('Rezept gelöscht');
  };

  return (
    <div>
      <div className="hero">
        <RecipeImage recipe={recipe} />
        <div className="hero-actions">
          <button className="icon-btn solid" onClick={() => history.back()} aria-label="Zurück">
            <ArrowLeft size={20} />
          </button>
          <div className="row">
            <button
              className={`icon-btn solid fav-btn ${recipe.favorite ? 'on' : ''}`}
              onClick={() => store.put('recipes', recipe.id, { ...recipe, favorite: !recipe.favorite })}
              aria-label={recipe.favorite ? 'Kein Favorit mehr' : 'Als Favorit markieren'}
              aria-pressed={!!recipe.favorite}
            >
              <Heart size={20} fill={recipe.favorite ? 'currentColor' : 'none'} />
            </button>
            <button className="icon-btn solid" onClick={() => navigate({ name: 'bearbeiten', id })} aria-label="Bearbeiten">
              <Pencil size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="detail-head">
        <h1>{recipe.title}</h1>
        <RecipeBadges recipe={recipe} month={month} batch />
        <div className="meta-grid">
          <div className="meta">
            <small>Portionen</small>
            <strong>{recipe.servings ?? '–'}</strong>
          </div>
          <div className="meta">
            <small>Zeit</small>
            <strong>{recipe.time ? `${recipe.time} min` : '–'}</strong>
          </div>
          <div className="meta">
            <small>Zuletzt</small>
            <strong>{lastPast ? lastLabel(weeksBetween(lastPast, week)) : 'noch nie'}</strong>
          </div>
        </div>
        <div className="row wrap">
          <button className="btn primary" onClick={planIt}>
            <CalendarPlus size={18} /> In KW {isoWeekNumber(week)} einplanen
          </button>
          {recipe.sourceUrl && (
            <a className="btn soft" href={recipe.sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> Quelle
            </a>
          )}
        </div>
        {seasonMonths && (
          <p className="small muted" style={{ margin: 0 }}>
            🍃 Saison: {formatMonths(seasonMonths, MONTHS_SHORT)}
            {season.manual ? ' (manuell festgelegt)' : strictNames.length ? ` – wegen ${strictNames.join(', ')}` : ''}
          </p>
        )}
      </div>

      <div className="page" style={{ paddingTop: 20 }}>
        <section className="card card-pad stack">
          <h2>Zutaten</h2>
          {recipe.flexVeg && <FlexVegBox recipe={recipe} month={month} pantry={pantry.map((p) => p.name)} />}
          {recipe.ingredients.length ? (
            <ul className="ing-list">
              {recipe.ingredients.map((ing, i) => (
                <li key={i}>
                  <span className="ing-qty">{ing.qty !== undefined ? formatQty(ing.qty, ing.unit ?? '') : ''}</span>
                  <span>
                    {ing.name}
                    {ing.note && <span className="ing-note"> · {ing.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Keine Zutaten eingetragen.</p>
          )}
        </section>

        {recipe.steps.length > 0 && (
          <section className="card card-pad stack">
            <h2>Zubereitung</h2>
            <ol className="steps">
              {recipe.steps.map((s, i) => (
                <li key={i} className={s.endsWith(':') && s.length < 60 ? 'heading' : ''}>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {recipe.notes && (
          <section className="card card-pad stack">
            <h2>Notizen</h2>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{recipe.notes}</p>
          </section>
        )}

        {cookedWeeks.length > 0 && (
          <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
            Eingeplant in KW {cookedWeeks.slice(0, 6).map(isoWeekNumber).join(', ')}
            {cookedWeeks.length > 6 ? ' …' : ''}
          </p>
        )}

        <button className="btn danger" onClick={remove}>
          <Trash2 size={16} /> Rezept löschen
        </button>
      </div>
    </div>
  );
}

function lastLabel(weeks: number) {
  if (weeks <= 0) return 'diese Woche';
  if (weeks === 1) return 'letzte Woche';
  return `vor ${weeks} Wo.`;
}

export function FlexVegBox({ recipe, month, pantry }: { recipe: Recipe; month: number; pantry: string[] }) {
  const atHome = pantry.filter(isVegetable);
  const seasonal = produceInSeason(month, 'gemuese')
    .sort((a, b) => Number(!!b.strict) - Number(!!a.strict))
    .slice(0, 6)
    .map((p) => p.name);
  return (
    <div className="flex-box">
      <strong>+ {recipe.flexVeg?.amount ? `${recipe.flexVeg.amount} ` : ''}Gemüse nach Wahl</strong>
      {atHome.length > 0 && <div>Habt ihr da: {atHome.join(', ')}</div>}
      <div className="small">Gerade Saison: {seasonal.join(', ')}</div>
    </div>
  );
}
