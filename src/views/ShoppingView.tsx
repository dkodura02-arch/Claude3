import { useMemo, useState } from 'react';
import { Check, ChevronRight, Plus, RotateCcw, Share2, Trash2 } from 'lucide-react';
import { navigate, useApp } from '../AppState';
import { isoWeekNumber, weekMonth, weekRangeLabel } from '../lib/dates';
import { uid, useCollection } from '../lib/hooks';
import { aggregate, CATEGORY_LABELS, CATEGORY_ORDER, matchesPantry, type AggregatedItem } from '../lib/ingredients';
import { produceInSeason } from '../lib/season';
import { isVegetable } from '../lib/shuffle';
import { store } from '../lib/store';
import type { Recipe } from '../lib/types';

interface Row {
  id: string;
  name: string;
  amount?: string;
  from?: string;
  hint?: string;
  checked: boolean;
  toggle: () => void;
  remove?: () => void;
}

const BASICS = /^(salz|pfeffer|salz und pfeffer|salz & pfeffer|wasser|öl|olivenöl|rapsöl|sonnenblumenöl|pflanzenöl|zucker)$/i;

export function ShoppingView() {
  const { week, showToast } = useApp();
  const recipes = useCollection('recipes');
  const plans = useCollection('plans');
  const pantryDocs = useCollection('pantry');
  useCollection('shopcheck');
  useCollection('shopitem');
  const [text, setText] = useState('');
  const month = weekMonth(week);

  const plan = plans.find((p) => p.week === week);
  const dishes = useMemo(() => {
    const byId = new Map(recipes.map((r) => [r.id, r]));
    return [plan?.big, plan?.small].map((id) => (id ? byId.get(id) : undefined)).filter((r): r is Recipe => !!r);
  }, [recipes, plan?.big, plan?.small]);
  const pantry = pantryDocs.map((p) => p.name);

  const checkId = (key: string) => `${week}|${key}`;
  const isChecked = (key: string) => !!store.get('shopcheck', checkId(key))?.checked;
  const toggle = (key: string) => {
    if (isChecked(key)) store.remove('shopcheck', checkId(key));
    else store.put('shopcheck', checkId(key), { checked: true });
  };

  const items = useMemo(
    () => aggregate(dishes.map((r) => ({ ingredients: r.ingredients, from: r.title }))),
    [dishes],
  );
  const toRow = (it: AggregatedItem): Row => ({
    id: it.key,
    name: it.name,
    amount: it.amounts.join(' + ') || undefined,
    from: dishes.length > 1 ? it.sources.join(' · ') : undefined,
    checked: isChecked(it.key),
    toggle: () => toggle(it.key),
  });

  const atHome = items.filter((it) => pantry.some((p) => matchesPantry(it.name, p)));
  const basics = items.filter((it) => !atHome.includes(it) && BASICS.test(it.name.trim()));
  const toBuy = items.filter((it) => !atHome.includes(it) && !basics.includes(it));

  const flexRows: Row[] = dishes
    .filter((r) => r.flexVeg)
    .map((r) => {
      const key = `flex-${r.id}`;
      const vegAtHome = pantry.filter(isVegetable);
      const seasonal = produceInSeason(month, 'gemuese')
        .sort((a, b) => Number(!!b.strict) - Number(!!a.strict))
        .slice(0, 5)
        .map((p) => p.name);
      return {
        id: key,
        name: 'Gemüse nach Wahl',
        amount: r.flexVeg?.amount,
        from: r.title,
        hint: vegAtHome.length ? `Habt ihr da: ${vegAtHome.join(', ')}` : `Saison: ${seasonal.join(', ')}`,
        checked: isChecked(key),
        toggle: () => toggle(key),
      };
    });

  const manualRows: Row[] = store
    .entries('shopitem')
    .sort(([, a], [, b]) => a.createdAt - b.createdAt)
    .map(([id, m]) => {
      return {
        id: `m-${id}`,
        name: m.text,
        checked: m.checked,
        toggle: () => store.put('shopitem', id, { ...m, checked: !m.checked }),
        remove: () => store.remove('shopitem', id),
      };
    });

  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    rows: [...(cat === 'gemuese' ? flexRows : []), ...toBuy.filter((i) => i.category === cat).map(toRow)],
  })).filter((g) => g.rows.length);

  const allRows = [...groups.flatMap((g) => g.rows), ...manualRows];
  const open = allRows.filter((r) => !r.checked);
  const done = allRows.filter((r) => r.checked);

  const addManual = () => {
    const t = text.trim();
    if (!t) return;
    store.put('shopitem', uid(), { text: t, checked: false, createdAt: Date.now() });
    setText('');
  };

  const reset = () => {
    store.batch(() => {
      for (const [id] of store.entries('shopcheck')) if (id.startsWith(`${week}|`)) store.remove('shopcheck', id);
      for (const [id, m] of store.entries('shopitem')) if (m.checked) store.remove('shopitem', id);
    });
  };

  const share = async () => {
    const lines = [`Einkaufsliste KW ${isoWeekNumber(week)}`];
    for (const g of groups) {
      const rows = g.rows.filter((r) => !r.checked);
      if (!rows.length) continue;
      lines.push('', CATEGORY_LABELS[g.cat]);
      rows.forEach((r) => lines.push(`• ${r.amount ? `${r.amount} ` : ''}${r.name}`));
    }
    const m = manualRows.filter((r) => !r.checked);
    if (m.length) {
      lines.push('', 'Sonstiges');
      m.forEach((r) => lines.push(`• ${r.name}`));
    }
    const textOut = lines.join('\n');
    try {
      if (navigator.share) await navigator.share({ title: 'Einkaufsliste', text: textOut });
      else {
        await navigator.clipboard.writeText(textOut);
        showToast('Liste kopiert');
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="page">
      <div className="row">
        <div style={{ flex: 1 }}>
          <h2>KW {isoWeekNumber(week)}</h2>
          <span className="small muted">
            {weekRangeLabel(week)}
            {dishes.length > 0 && ` · ${dishes.map((d) => d.title).join(' & ')}`}
          </span>
        </div>
        {allRows.length > 0 && (
          <button className="icon-btn solid" onClick={share} aria-label="Liste teilen">
            <Share2 size={18} />
          </button>
        )}
      </div>

      <form
        className="pantry-input"
        onSubmit={(e) => {
          e.preventDefault();
          addManual();
        }}
      >
        <input className="input" placeholder="Eigener Eintrag, z. B. Kaffee" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn primary" type="submit" aria-label="Hinzufügen">
          <Plus size={18} />
        </button>
      </form>

      {dishes.length === 0 && manualRows.length === 0 ? (
        <div className="card empty">
          <div className="big-emoji">🛒</div>
          <h2>Noch nichts geplant</h2>
          <p>Würfelt zuerst eure Woche – die Einkaufsliste entsteht dann automatisch aus den Rezepten.</p>
          <button className="btn primary" onClick={() => navigate({ name: 'woche' })}>
            Zur Woche
          </button>
        </div>
      ) : (
        <>
          <div className="card shop-group">
            {groups.map((g) => {
              const rows = g.rows.filter((r) => !r.checked);
              if (!rows.length) return null;
              return (
                <div key={g.cat}>
                  <h3>{CATEGORY_LABELS[g.cat]}</h3>
                  {rows.map((r) => (
                    <ShopRow key={r.id} row={r} />
                  ))}
                </div>
              );
            })}
            {manualRows.some((r) => !r.checked) && (
              <div>
                <h3>Eigene Einträge</h3>
                {manualRows
                  .filter((r) => !r.checked)
                  .map((r) => (
                    <ShopRow key={r.id} row={r} />
                  ))}
              </div>
            )}
            {open.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 16 }}>Alles im Wagen 🎉</p>}
          </div>

          {done.length > 0 && (
            <details className="card collapse">
              <summary>
                <ChevronRight size={18} className="chev" />
                Erledigt ({done.length})
                <span className="spacer" />
                <button
                  className="btn ghost sm"
                  onClick={(e) => {
                    e.preventDefault();
                    reset();
                  }}
                >
                  <RotateCcw size={14} /> Zurücksetzen
                </button>
              </summary>
              <div className="shop-group">
                {done.map((r) => (
                  <ShopRow key={r.id} row={r} />
                ))}
              </div>
            </details>
          )}

          {basics.length > 0 && (
            <details className="card collapse">
              <summary>
                <ChevronRight size={18} className="chev" />
                Basics – meist zu Hause ({basics.length})
              </summary>
              <div className="shop-group">
                {basics.map((it) => (
                  <ShopRow key={it.key} row={toRow(it)} />
                ))}
              </div>
            </details>
          )}

          {atHome.length > 0 && (
            <details className="card collapse">
              <summary>
                <ChevronRight size={18} className="chev" />
                Habt ihr schon da ({atHome.length})
              </summary>
              <div className="shop-group">
                {atHome.map((it) => (
                  <div key={it.key} className="shop-item done">
                    <span className="check">
                      <Check size={16} />
                    </span>
                    <div className="shop-main">
                      <span className="shop-name">{it.name}</span>
                      {it.amounts.length > 0 && <span className="shop-amount">{it.amounts.join(' + ')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function ShopRow({ row }: { row: Row }) {
  return (
    <div className={`shop-item ${row.checked ? 'done' : ''}`} onClick={row.toggle} role="checkbox" aria-checked={row.checked}>
      <span className="check">
        <Check size={16} />
      </span>
      <div className="shop-main">
        <span className="shop-name">{row.name}</span>
        {row.amount && <span className="shop-amount">{row.amount}</span>}
        {(row.from || row.hint) && <div className="shop-from">{[row.hint, row.from].filter(Boolean).join(' · ')}</div>}
      </div>
      {row.remove && (
        <button
          className="icon-btn"
          style={{ width: 32, height: 32 }}
          onClick={(e) => {
            e.stopPropagation();
            row.remove!();
          }}
          aria-label="Entfernen"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
