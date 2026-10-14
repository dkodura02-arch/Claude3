import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ClipboardPaste, FileText, Link2, Loader2, PenLine } from 'lucide-react';
import { navigate, useApp } from '../AppState';
import { RecipeEditor } from './RecipeEditor';
import { Segmented } from '../components/ui';
import { errorMessage } from '../lib/api';
import { uid } from '../lib/hooks';
import { guessBatch, guessCarb, guessEffort, parseRecipeHtml, parseRecipeText, type ImportedRecipe } from '../lib/importer';
import { recipesFromPdf } from '../lib/pdf';
import { store } from '../lib/store';
import type { Batch, Recipe } from '../lib/types';

type Stage = 'choose' | 'link' | 'text' | 'edit' | 'bulk';

interface BulkItem {
  recipe: ImportedRecipe;
  batch: Batch;
  include: boolean;
}

function fromImport(r: ImportedRecipe, batch: Batch): Recipe {
  const recipe: Recipe = {
    id: uid(),
    title: r.title || 'Rezept',
    image: r.imageUrl ? { url: r.imageUrl } : undefined,
    sourceUrl: r.sourceUrl,
    servings: r.servings,
    time: r.time,
    batch,
    effort: guessEffort(r.time),
    price: 2,
    carb: guessCarb(r.ingredients),
    ingredients: r.ingredients,
    steps: r.steps,
    notes: r.notes,
    createdAt: Date.now(),
  };
  return JSON.parse(JSON.stringify(recipe)) as Recipe;
}

export function AddRecipe() {
  const { draft, setDraft } = useApp();
  const [stage, setStage] = useState<Stage>(draft ? 'edit' : 'choose');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulk, setBulk] = useState<BulkItem[]>([]);
  const pdfRef = useRef<HTMLInputElement>(null);
  const { showToast } = useApp();

  // leaving "Rezept hinzufügen" (e.g. via the bottom bar) discards an unsaved import
  useEffect(() => () => setDraft(null), [setDraft]);

  if (stage === 'edit') return <RecipeEditor key={draft?.title ?? 'leer'} />;

  const importPdfs = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const found: ImportedRecipe[] = [];
    const failed: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const list = await recipesFromPdf(file);
        if (!list.length) failed.push(`${file.name}: kein Rezept erkannt`);
        found.push(...list);
      } catch (e) {
        failed.push(`${file.name}: ${errorMessage(e)}`);
      }
    }
    setBusy(false);
    if (pdfRef.current) pdfRef.current.value = '';
    if (failed.length) setError(failed.join('\n'));
    if (found.length === 1 && !failed.length) {
      setDraft(found[0]);
      setStage('edit');
    } else if (found.length) {
      setBulk(found.map((r) => ({ recipe: r, batch: guessBatch(r.servings), include: true })));
      setStage('bulk');
    }
  };

  const saveBulk = () => {
    const chosen = bulk.filter((b) => b.include);
    store.batch(() => {
      for (const b of chosen) {
        const r = fromImport(b.recipe, b.batch);
        store.put('recipes', r.id, r);
      }
    });
    showToast(`${chosen.length} Rezepte gespeichert – Aufwand und Preis könnt ihr beim Rezept anpassen`);
    navigate({ name: 'rezepte' }, true);
  };

  const importLink = async () => {
    const link = url.trim().match(/https?:\/\/\S+/)?.[0];
    if (!link) {
      setError('Bitte einen Link einfügen (beginnt mit https://).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const html = await fetchPage(link);
      const recipe = parseRecipeHtml(html, link);
      if (!recipe) throw new Error('Auf der Seite wurde kein Rezept gefunden.');
      setDraft(recipe);
      setStage('edit');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const importText = () => {
    if (!text.trim()) return;
    setDraft(parseRecipeText(text));
    setStage('edit');
  };

  const back = () => {
    if (stage === 'choose') history.back();
    else {
      setStage('choose');
      setError(null);
    }
  };

  return (
    <div className="page">
      <div className="row">
        <button className="icon-btn solid" onClick={back} aria-label="Zurück">
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ flex: 1 }}>Rezept hinzufügen</h2>
      </div>

      {stage === 'choose' && (
        <div className="stack">
          <button className="option" onClick={() => setStage('link')}>
            <span className="ico">
              <Link2 size={22} />
            </span>
            <div>
              <strong>Von einer Webseite</strong>
              <span>Link einfügen – Chefkoch, KptnCook, Lecker, Blogs …</span>
            </div>
          </button>
          <button className="option" onClick={() => setStage('text')}>
            <span className="ico">
              <ClipboardPaste size={22} />
            </span>
            <div>
              <strong>Text einfügen</strong>
              <span>Aus Notizen, WhatsApp oder E-Mail kopieren</span>
            </div>
          </button>
          <button className="option" onClick={() => pdfRef.current?.click()} disabled={busy}>
            <span className="ico">{busy ? <Loader2 size={22} className="spin" /> : <FileText size={22} />}</span>
            <div>
              <strong>{busy ? 'PDF wird gelesen …' : 'PDF hochladen'}</strong>
              <span>Export aus einer Kochbuch-App – auch mehrere Dateien oder Rezepte auf einmal</span>
            </div>
          </button>
          <input ref={pdfRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => importPdfs(e.target.files)} />
          {error && <div className="notice err" style={{ whiteSpace: 'pre-line' }}>{error}</div>}
          <button
            className="option"
            onClick={() => {
              setDraft(null);
              setStage('edit');
            }}
          >
            <span className="ico">
              <PenLine size={22} />
            </span>
            <div>
              <strong>Selbst eingeben</strong>
              <span>Eigenes Rezept mit Foto</span>
            </div>
          </button>
        </div>
      )}

      {stage === 'link' && (
        <div className="card card-pad stack">
          <div className="field">
            <label htmlFor="url">Link zum Rezept</label>
            <input
              id="url"
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://www.chefkoch.de/rezepte/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && importLink()}
              autoFocus
            />
            <span className="hint">Tipp: In der KptnCook-App beim Rezept auf „Teilen“ tippen und den Link kopieren.</span>
          </div>
          {!store.online && (
            <div className="notice">
              Für den Link-Import muss Google Drive verbunden sein (Einstellungen). Ohne Verbindung klappt es nur bei wenigen Seiten.
            </div>
          )}
          {error && <div className="notice err">{error}</div>}
          <button className="btn primary" onClick={importLink} disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : <Link2 size={18} />}
            {busy ? 'Rezept wird geladen …' : 'Rezept übernehmen'}
          </button>
          {error && (
            <button
              className="btn ghost"
              onClick={() => {
                setDraft({ title: '', sourceUrl: url.trim(), ingredients: [], steps: [] });
                setStage('edit');
              }}
            >
              Stattdessen von Hand eintragen
            </button>
          )}
        </div>
      )}

      {stage === 'bulk' && (
        <div className="stack">
          <div className="notice ok">
            {bulk.length} Rezepte gefunden. Wählt aus, welche ihr übernehmen wollt, und ob es Big oder Small Batch ist.
          </div>
          {error && <div className="notice err" style={{ whiteSpace: 'pre-line' }}>{error}</div>}
          {bulk.map((b, i) => (
            <div key={i} className="card card-pad stack" style={{ gap: 10, opacity: b.include ? 1 : 0.55 }}>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={b.include}
                  onChange={(e) => setBulk(bulk.map((x, k) => (k === i ? { ...x, include: e.target.checked } : x)))}
                />
                <span>
                  <strong>{b.recipe.title}</strong>
                  <br />
                  <span className="hint">
                    {b.recipe.ingredients.length} Zutaten · {b.recipe.steps.length} {b.recipe.steps.length === 1 ? 'Schritt' : 'Schritte'}
                    {b.recipe.servings ? ` · ${b.recipe.servings} Portionen` : ''}
                  </span>
                </span>
              </label>
              {b.include && (
                <Segmented
                  value={b.batch}
                  onChange={(v) => setBulk(bulk.map((x, k) => (k === i ? { ...x, batch: v } : x)))}
                  options={[
                    { id: 'big', label: 'Big Batch' },
                    { id: 'small', label: 'Small Batch' },
                  ]}
                />
              )}
            </div>
          ))}
          <div className="sticky-actions">
            <button className="btn ghost" onClick={back}>
              Abbrechen
            </button>
            <button className="btn primary" onClick={saveBulk} disabled={!bulk.some((b) => b.include)}>
              {bulk.filter((b) => b.include).length} speichern
            </button>
          </div>
        </div>
      )}

      {stage === 'text' && (
        <div className="card card-pad stack">
          <div className="field">
            <label htmlFor="text">Rezepttext</label>
            <textarea
              id="text"
              className="textarea"
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Linsen-Dal\n\nZutaten\n250 g rote Linsen\n1 Dose Tomaten\n…\n\nZubereitung\nLinsen waschen …'}
              autoFocus
            />
            <span className="hint">Erste Zeile = Titel. Mit den Überschriften „Zutaten“ und „Zubereitung“ klappt die Erkennung am besten.</span>
          </div>
          <button className="btn primary" onClick={importText} disabled={!text.trim()}>
            Weiter
          </button>
        </div>
      )}

      {stage === 'choose' && (
        <button className="btn ghost" onClick={() => navigate({ name: 'rezepte' })}>
          Abbrechen
        </button>
      )}
    </div>
  );
}

async function fetchPage(url: string): Promise<string> {
  if (store.online) {
    const res = await store.call<{ status: number; body: string }>({ op: 'fetch', url });
    if (res.status >= 400) throw new Error(`Die Seite hat den Abruf abgelehnt (Fehler ${res.status}).`);
    return res.body;
  }
  // Without the Google script only pages that allow cross-origin requests work
  try {
    const res = await fetch(url);
    return await res.text();
  } catch {
    throw new Error('Die Seite lässt sich ohne Google-Drive-Verbindung nicht abrufen. Bitte zuerst in den Einstellungen verbinden.');
  }
}
