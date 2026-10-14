import { useState } from 'react';
import { ArrowLeft, ClipboardPaste, Link2, Loader2, PenLine } from 'lucide-react';
import { navigate, useApp } from '../AppState';
import { RecipeEditor } from './RecipeEditor';
import { errorMessage } from '../lib/api';
import { parseRecipeHtml, parseRecipeText } from '../lib/importer';
import { store } from '../lib/store';

type Stage = 'choose' | 'link' | 'text' | 'edit';

export function AddRecipe() {
  const { draft, setDraft } = useApp();
  const [stage, setStage] = useState<Stage>(draft ? 'edit' : 'choose');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (stage === 'edit') return <RecipeEditor key={draft?.title ?? 'leer'} />;

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
