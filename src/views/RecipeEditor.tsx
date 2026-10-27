import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, ImagePlus, Leaf, Trash2 } from 'lucide-react';
import { navigate, useApp } from '../AppState';
import { RecipeImage, Segmented } from '../components/ui';
import { uid, useDoc } from '../lib/hooks';
import { compressImage } from '../lib/image';
import { guessBatch, guessCarb, guessEffort, type ImportedRecipe } from '../lib/importer';
import { formatQty, parseIngredientLines } from '../lib/ingredients';
import { BATCHES, CARBS, EFFORTS, MONTHS_SHORT, PRICES, PRICE_WORDS } from '../lib/labels';
import { findProduce, formatMonths, recipeSeasonMonths } from '../lib/season';
import { store } from '../lib/store';
import type { Batch, Carb, Effort, Ingredient, Price, Recipe, RecipeImage as Img } from '../lib/types';

const ingredientsToText = (list: Ingredient[]) => list.map((i) => i.text).join('\n');

function initial(recipe: Recipe | undefined, draft: ImportedRecipe | null) {
  if (recipe) {
    return {
      title: recipe.title,
      image: recipe.image,
      sourceUrl: recipe.sourceUrl ?? '',
      servings: recipe.servings ? String(recipe.servings) : '',
      time: recipe.time ? String(recipe.time) : '',
      batch: recipe.batch,
      effort: recipe.effort,
      price: recipe.price,
      carb: recipe.carb,
      flex: !!recipe.flexVeg,
      flexAmount: recipe.flexVeg?.amount ?? '',
      slow: !!recipe.slowCooker,
      ingredients: ingredientsToText(recipe.ingredients),
      steps: recipe.steps.join('\n'),
      notes: recipe.notes ?? '',
      manualSeason: !!recipe.seasonMonths?.length,
      months: recipe.seasonMonths ?? [],
    };
  }
  const d = draft;
  return {
    title: d?.title ?? '',
    image: d?.imageUrl ? { url: d.imageUrl } : undefined,
    sourceUrl: d?.sourceUrl ?? '',
    servings: d?.servings ? String(d.servings) : '',
    time: d?.time ? String(d.time) : '',
    batch: guessBatch(d?.servings) as Batch,
    effort: guessEffort(d?.time) as Effort,
    price: 2 as Price,
    carb: d ? guessCarb(d.ingredients) : ('ohne' as Carb),
    flex: false,
    flexAmount: '',
    slow: false,
    ingredients: d ? ingredientsToText(d.ingredients) : '',
    steps: d?.steps.join('\n') ?? '',
    notes: d?.notes ?? '',
    manualSeason: false,
    months: [] as number[],
  };
}

export function RecipeEditor({ id }: { id?: string }) {
  const { draft, setDraft, showToast } = useApp();
  const existing = useDoc('recipes', id);
  const [f, setF] = useState(() => initial(existing, draft));
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const parsed = useMemo(() => parseIngredientLines(f.ingredients), [f.ingredients]);
  const detectedMonths = useMemo(() => recipeSeasonMonths({ ingredients: parsed }), [parsed]);
  const detectedNames = useMemo(
    () => [...new Set(parsed.map((i) => findProduce(i.name)).filter((p) => p?.strict).map((p) => p!.name))],
    [parsed],
  );
  const suggestedCarb = useMemo(() => guessCarb(parsed), [parsed]);

  if (id && !existing) {
    return (
      <div className="page">
        <p>Rezept nicht gefunden.</p>
      </div>
    );
  }

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      set('image', { url: dataUrl });
    } catch (e) {
      showToast((e as Error).message);
    }
  };

  const save = async () => {
    if (!f.title.trim()) {
      showToast('Bitte einen Titel eingeben');
      return;
    }
    setBusy(true);
    const recipeId = existing?.id ?? uid();
    const oldDriveId = existing?.image?.driveId;
    let image: Img | undefined = f.image;
    if (oldDriveId && image?.driveId !== oldDriveId) store.trashImage(oldDriveId);

    const recipe: Recipe = {
      id: recipeId,
      title: f.title.trim(),
      image,
      sourceUrl: f.sourceUrl.trim() || undefined,
      servings: Number(f.servings) || undefined,
      time: Number(f.time) || undefined,
      batch: f.batch,
      effort: f.effort,
      price: f.price,
      carb: f.carb,
      flexVeg: f.flex ? { amount: f.flexAmount.trim() || undefined } : undefined,
      // stored as false (not left out) so the collection update doesn't switch it back on
      slowCooker: f.slow,
      ingredients: parsed,
      steps: f.steps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      notes: f.notes.trim() || undefined,
      seasonMonths: f.manualSeason && f.months.length ? [...f.months].sort((a, b) => a - b) : undefined,
      sample: existing?.sample,
      favorite: existing?.favorite,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    // drop undefined fields so the stored JSON stays clean
    store.put('recipes', recipeId, JSON.parse(JSON.stringify(recipe)) as Recipe);
    setDraft(null);
    setBusy(false);
    showToast(existing ? 'Gespeichert' : 'Rezept angelegt');
    navigate({ name: 'rezept', id: recipeId }, true);

    // Pictures from recipe websites are copied into Drive so they don't disappear later
    if (image && /^https?:/.test(image.url) && !image.driveId && store.online) {
      store
        .call<{ id: string; url: string }>({ op: 'saveImageUrl', url: image.url, name: recipe.title })
        .then((res) => {
          const cur = store.get('recipes', recipeId);
          if (cur && cur.image?.url === image!.url && res.url) {
            image = { url: res.url, driveId: res.id };
            store.put('recipes', recipeId, { ...cur, image });
          }
        })
        .catch(() => undefined);
    }
  };

  const cancel = () => {
    setDraft(null);
    history.back();
  };

  return (
    <div className="page">
      <div className="row">
        <button className="icon-btn solid" onClick={cancel} aria-label="Zurück">
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ flex: 1 }}>{existing ? 'Rezept bearbeiten' : 'Neues Rezept'}</h2>
      </div>

      <div className={`image-pick ${f.image ? 'has' : ''}`} onClick={() => fileRef.current?.click()}>
        {f.image ? (
          <>
            <RecipeImage recipe={{ id: existing?.id ?? 'neu', title: f.title, carb: f.carb, image: f.image }} />
            <div className="overlay-actions">
              <button
                className="icon-btn solid"
                onClick={(e) => {
                  e.stopPropagation();
                  set('image', undefined);
                }}
                aria-label="Bild entfernen"
              >
                <Trash2 size={18} />
              </button>
              <span className="icon-btn solid">
                <Camera size={18} />
              </span>
            </div>
          </>
        ) : (
          <div className="stack" style={{ alignItems: 'center', gap: 6 }}>
            <ImagePlus size={32} />
            <span className="small">Foto aufnehmen oder auswählen</span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
      </div>

      <div className="field">
        <label htmlFor="title">Titel</label>
        <input id="title" className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="z. B. Kürbis-Curry" />
      </div>

      <div className="field">
        <span className="field-label">Typ</span>
        <Segmented value={f.batch} onChange={(v) => set('batch', v)} options={BATCHES.map((b) => ({ id: b.id, label: b.label, hint: b.hint }))} />
      </div>

      <div className="field">
        <span className="field-label">Aufwand</span>
        <Segmented value={f.effort} onChange={(v) => set('effort', v)} options={EFFORTS.map((e) => ({ id: e.id, label: e.label }))} />
      </div>

      <div className="field">
        <span className="field-label">
          Preis · <span style={{ fontWeight: 500 }}>{PRICE_WORDS[f.price]}</span>
        </span>
        <div className="price-picker">
          {PRICES.map((p) => (
            <button key={p} type="button" className={f.price >= p ? 'on' : ''} onClick={() => set('price', p)} aria-label={`Preis ${p}`}>
              €
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Kohlenhydrate</span>
        <div className="carb-grid">
          <div className="chips">
            {CARBS.filter((c) => c.main).map((c) => (
              <button key={c.id} type="button" className={`chip ${f.carb === c.id ? 'on' : ''}`} onClick={() => set('carb', c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="chips">
            {CARBS.filter((c) => !c.main).map((c) => (
              <button key={c.id} type="button" className={`chip minor ${f.carb === c.id ? 'on' : ''}`} onClick={() => set('carb', c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          {suggestedCarb !== 'ohne' && suggestedCarb !== f.carb && (
            <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('carb', suggestedCarb)}>
              Laut Zutaten eher: {CARBS.find((c) => c.id === suggestedCarb)?.label} – übernehmen?
            </button>
          )}
        </div>
      </div>

      <div className="card card-pad stack">
        <label className="switch">
          <input type="checkbox" checked={f.flex} onChange={(e) => set('flex', e.target.checked)} />
          <span>
            <strong>Flexibles Gemüse</strong>
            <br />
            <span className="hint">Feste Zutaten + Gemüse nach Wahl (z. B. Asia-Pfanne)</span>
          </span>
        </label>
        {f.flex && (
          <input className="input" value={f.flexAmount} onChange={(e) => set('flexAmount', e.target.value)} placeholder="Menge, z. B. 400 g" />
        )}
      </div>

      <div className="card card-pad stack">
        <label className="switch">
          <input type="checkbox" checked={f.slow} onChange={(e) => set('slow', e.target.checked)} />
          <span>
            <strong>Slow Cooker</strong>
            <br />
            <span className="hint">Lässt sich im Slow Cooker zubereiten – beim Würfeln filterbar</span>
          </span>
        </label>
      </div>

      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="servings">Portionen</label>
          <input id="servings" className="input" inputMode="numeric" value={f.servings} onChange={(e) => set('servings', e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="time">Zeit (Minuten)</label>
          <input id="time" className="input" inputMode="numeric" value={f.time} onChange={(e) => set('time', e.target.value.replace(/\D/g, ''))} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="ing">Zutaten – eine pro Zeile</label>
        <textarea
          id="ing"
          className="textarea"
          rows={8}
          value={f.ingredients}
          onChange={(e) => set('ingredients', e.target.value)}
          placeholder={'500 g Kartoffeln\n2 Zwiebeln\n1 EL Olivenöl'}
        />
        {parsed.length > 0 && (
          <span className="hint">
            {parsed.length} Zutaten erkannt
            {parsed.some((p) => p.qty !== undefined) &&
              ` · z. B. ${parsed
                .filter((p) => p.qty !== undefined)
                .slice(0, 2)
                .map((p) => `${formatQty(p.qty!, p.unit ?? '')} ${p.name}`)
                .join(', ')}`}
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="steps">Zubereitung – ein Schritt pro Zeile</label>
        <textarea id="steps" className="textarea" rows={7} value={f.steps} onChange={(e) => set('steps', e.target.value)} />
      </div>

      <div className="card card-pad stack">
        <div className="row">
          <Leaf size={18} className="muted" />
          <strong style={{ flex: 1 }}>Saison</strong>
        </div>
        <Segmented
          value={f.manualSeason ? 'manual' : 'auto'}
          onChange={(v) => set('manualSeason', v === 'manual')}
          options={[
            { id: 'auto', label: 'Automatisch' },
            { id: 'manual', label: 'Selbst festlegen' },
          ]}
        />
        {f.manualSeason ? (
          <div className="months">
            {MONTHS_SHORT.map((m, i) => (
              <button
                key={m}
                type="button"
                className={f.months.includes(i + 1) ? 'on' : ''}
                onClick={() => set('months', f.months.includes(i + 1) ? f.months.filter((x) => x !== i + 1) : [...f.months, i + 1])}
              >
                {m}
              </button>
            ))}
          </div>
        ) : (
          <span className="hint">
            {detectedMonths
              ? `Erkannt: ${detectedNames.join(', ')} → Saison ${formatMonths(detectedMonths, MONTHS_SHORT)}. Außerhalb davon wird das Rezept nicht vorgeschlagen.`
              : 'Keine typischen Saisonzutaten erkannt – das Rezept passt das ganze Jahr. Saisonales Gemüse wird trotzdem bevorzugt, wenn es gerade Saison hat.'}
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="notes">Notizen</label>
        <textarea id="notes" className="textarea" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Tipps, Varianten …" />
      </div>

      <div className="field">
        <label htmlFor="src">Quelle (Link)</label>
        <input id="src" className="input" type="url" value={f.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} placeholder="https://…" />
      </div>

      <div className="sticky-actions">
        <button className="btn ghost" onClick={cancel}>
          Abbrechen
        </button>
        <button className="btn primary" onClick={save} disabled={busy}>
          Speichern
        </button>
      </div>
    </div>
  );
}
