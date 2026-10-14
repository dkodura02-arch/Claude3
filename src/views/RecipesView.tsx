import { useMemo, useState } from 'react';
import { Heart, Plus, Search, Sparkles } from 'lucide-react';
import { navigate, useApp } from '../AppState';
import { EffortBadge, PriceBadge, RecipeImage, SeasonBadge } from '../components/ui';
import { weekMonth } from '../lib/dates';
import { useCollection } from '../lib/hooks';
import { CARBS, batchLabel, carbLabel } from '../lib/labels';
import { recipeSeason } from '../lib/season';
import { addStarterRecipes, missingStarterCount } from '../lib/samples';
import { store } from '../lib/store';
import type { Batch, Carb } from '../lib/types';

export function RecipesView() {
  const { week, showToast } = useApp();
  const recipes = useCollection('recipes');
  const month = weekMonth(week);
  const [q, setQ] = useState('');
  const [batch, setBatch] = useState<Batch | null>(null);
  const [carb, setCarb] = useState<Carb | null>(null);
  const [seasonOnly, setSeasonOnly] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const missing = missingStarterCount();
  const loadStarter = () => {
    const n = addStarterRecipes();
    showToast(`${n} Rezepte hinzugefügt`);
  };

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return recipes
      .filter((r) => !favOnly || r.favorite)
      .filter((r) => !batch || r.batch === batch)
      .filter((r) => !carb || r.carb === carb)
      .filter((r) => !seasonOnly || recipeSeason(r, month).strictHit || recipeSeason(r, month).hits.length > 0)
      .filter(
        (r) =>
          !needle ||
          r.title.toLowerCase().includes(needle) ||
          r.ingredients.some((i) => i.name.toLowerCase().includes(needle)),
      )
      .sort((a, b) => a.title.localeCompare(b.title, 'de'));
  }, [recipes, q, batch, carb, seasonOnly, favOnly, month]);

  const counts = { big: recipes.filter((r) => r.batch === 'big').length, small: recipes.filter((r) => r.batch === 'small').length };

  return (
    <div className="page">
      <div className="search">
        <Search size={18} />
        <input className="input" placeholder="Rezept oder Zutat suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="chips scroll">
        <button className={`chip ${!batch && !favOnly ? 'on' : ''}`} onClick={() => { setBatch(null); setFavOnly(false); }}>
          Alle · {recipes.length}
        </button>
        <button className={`chip ${favOnly ? 'on' : ''}`} onClick={() => setFavOnly(!favOnly)}>
          <Heart size={15} fill={favOnly ? 'currentColor' : 'none'} /> Favoriten · {recipes.filter((r) => r.favorite).length}
        </button>
        {(['big', 'small'] as Batch[]).map((b) => (
          <button key={b} className={`chip ${batch === b ? 'on' : ''}`} onClick={() => setBatch(batch === b ? null : b)}>
            {batchLabel(b)} · {counts[b]}
          </button>
        ))}
        <button className={`chip ${seasonOnly ? 'on' : ''}`} onClick={() => setSeasonOnly(!seasonOnly)}>
          🍃 Passt zur Saison
        </button>
      </div>
      <div className="chips scroll">
        {CARBS.map((c) => (
          <button key={c.id} className={`chip ${c.main ? '' : 'minor'} ${carb === c.id ? 'on' : ''}`} onClick={() => setCarb(carb === c.id ? null : c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {recipes.length === 0 ? (
        <div className="card empty">
          <div className="big-emoji">📖</div>
          <h2>Euer Rezeptbuch ist leer</h2>
          <p>Fügt Rezepte per Link (z. B. Chefkoch, KptnCook), als Text oder von Hand hinzu.</p>
          <button className="btn primary" onClick={() => navigate({ name: 'neu' })}>
            <Plus size={18} /> Rezept hinzufügen
          </button>
          {missing > 0 && (
            <button className="btn soft" onClick={loadStarter}>
              <Sparkles size={18} /> {missing} vegetarische Alltagsrezepte laden
            </button>
          )}
        </div>
      ) : list.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center' }}>
          Nichts gefunden.
        </p>
      ) : (
        <div className="grid">
          {list.map((r) => (
            <article
              key={r.id}
              className="rcard"
              role="link"
              tabIndex={0}
              onClick={() => navigate({ name: 'rezept', id: r.id })}
              onKeyDown={(e) => e.key === 'Enter' && navigate({ name: 'rezept', id: r.id })}
            >
              <div className="rcard-media">
                <RecipeImage recipe={r} />
                <span className={`badge ${r.batch}`}>{r.batch === 'big' ? 'Big' : 'Small'}</span>
                <button
                  className={`card-fav ${r.favorite ? 'on' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    store.put('recipes', r.id, { ...r, favorite: !r.favorite });
                  }}
                  aria-label={r.favorite ? `${r.title}: kein Favorit mehr` : `${r.title} als Favorit markieren`}
                  aria-pressed={!!r.favorite}
                >
                  <Heart size={20} fill={r.favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="rcard-body">
                <div className="rcard-title">{r.title}</div>
                <div className="badges">
                  <EffortBadge effort={r.effort} />
                  <PriceBadge price={r.price} />
                </div>
                <div className="rcard-meta">
                  {r.carb !== 'ohne' && <span>{carbLabel(r.carb)}</span>}
                  {r.flexVeg && <span>+ Gemüse nach Wahl</span>}
                  <SeasonBadge recipe={r} month={month} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {recipes.length > 0 && missing > 0 && (
        <div className="card card-pad stack" style={{ alignItems: 'flex-start' }}>
          <strong>Ideen gesucht?</strong>
          <span className="small muted">
            {missing} einfache, günstige Gerichte ohne Fleisch aus unserer Sammlung fehlen noch. Was euch nicht gefällt, löscht ihr einfach wieder.
          </span>
          <button className="btn soft sm" onClick={loadStarter}>
            <Sparkles size={16} /> Sammlung hinzufügen
          </button>
        </div>
      )}

      <button className="btn accent lg fab" onClick={() => navigate({ name: 'neu' })}>
        <Plus size={22} /> Rezept
      </button>
    </div>
  );
}
