import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Sheet, RecipeBadges, RecipeImage } from './ui';
import { batchLabel } from '../lib/labels';
import type { Batch, Recipe } from '../lib/types';

export function RecipePicker({
  recipes,
  batch,
  month,
  onPick,
  onClear,
  onClose,
}: {
  recipes: Recipe[];
  batch: Batch;
  month: number;
  onPick: (r: Recipe) => void;
  onClear?: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return recipes
      .filter((r) => all || r.batch === batch)
      .filter((r) => !needle || r.title.toLowerCase().includes(needle))
      .sort((a, b) => a.title.localeCompare(b.title, 'de'));
  }, [recipes, q, all, batch]);

  return (
    <Sheet title={`${batchLabel(batch)} auswählen`} onClose={onClose}>
      <div className="search">
        <Search size={18} />
        <input className="input" placeholder="Rezept suchen…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <label className="switch small">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
        Auch {batch === 'big' ? 'Small-Batch' : 'Big-Batch'}-Rezepte zeigen
      </label>
      <div className="stack">
        {list.map((r) => (
          <button key={r.id} className="list-row" onClick={() => onPick(r)}>
            <div className="thumb">
              <RecipeImage recipe={r} />
            </div>
            <div className="stack" style={{ gap: 6, minWidth: 0 }}>
              <strong>{r.title}</strong>
              <RecipeBadges recipe={r} month={month} batch={all} />
            </div>
          </button>
        ))}
        {list.length === 0 && <p className="muted small">Keine passenden Rezepte.</p>}
      </div>
      {onClear && (
        <button className="btn ghost" onClick={onClear}>
          Gericht aus dem Plan entfernen
        </button>
      )}
    </Sheet>
  );
}
