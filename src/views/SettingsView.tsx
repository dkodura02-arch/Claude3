import { useRef, useState } from 'react';
import { CheckCircle2, Cloud, Copy, Download, HardDrive, Link2, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useApp } from '../AppState';
import { callApi, errorMessage } from '../lib/api';
import { useStoreVersion } from '../lib/hooks';
import { store } from '../lib/store';
import scriptCode from '../../apps-script/Code.gs?raw';

function hashParam(name: string): string {
  const q = location.hash.split('?')[1] ?? '';
  return new URLSearchParams(q).get(name) ?? '';
}

export function SettingsView() {
  useStoreVersion();
  const { showToast } = useApp();
  const [url, setUrl] = useState(store.config?.url || hashParam('script'));
  const [password, setPassword] = useState(store.config?.password ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; folderUrl?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const samples = store.list('recipes').filter((r) => r.sample);

  const connect = async () => {
    const cfg = { url: url.trim(), password };
    if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(cfg.url)) {
      setResult({ ok: false, text: 'Die URL muss mit https://script.google.com/ beginnen.' });
      return;
    }
    if (!cfg.password) {
      setResult({ ok: false, text: 'Bitte das Haushalts-Passwort eingeben.' });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await callApi<{ folderUrl?: string }>(cfg, { op: 'ping' });
      store.setConfig(cfg);
      setResult({ ok: true, text: 'Verbunden! Eure Daten werden jetzt in Google Drive gespeichert.', folderUrl: res.folderUrl });
    } catch (e) {
      setResult({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(msg);
    } catch {
      showToast('Kopieren nicht möglich');
    }
  };

  const exportData = () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kochplaner-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file?: File) => {
    if (!file) return;
    try {
      const n = store.importJson(await file.text());
      showToast(`${n} Einträge importiert`);
    } catch (e) {
      showToast(errorMessage(e));
    }
  };

  const inviteLink = store.config ? `${location.origin}${location.pathname}#/einstellungen?script=${encodeURIComponent(store.config.url)}` : '';

  return (
    <div className="page">
      <section className="card card-pad stack">
        <div className="row">
          {store.online ? <Cloud size={22} className="muted" /> : <HardDrive size={22} className="muted" />}
          <h2 style={{ flex: 1 }}>Google Drive</h2>
        </div>

        {store.online ? (
          <>
            <div className={`notice ${store.status === 'error' || store.status === 'offline' ? 'err' : 'ok'}`}>
              {store.status === 'syncing' ? <Loader2 size={18} className="spin" /> : <CheckCircle2 size={18} />}
              <div>
                {store.status === 'error' || store.status === 'offline' ? (
                  store.error
                ) : (
                  <>
                    Verbunden – Daten liegen im Drive-Ordner „Kochplaner“.
                    {store.lastSync && <div className="small muted">Zuletzt abgeglichen: {new Date(store.lastSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>}
                  </>
                )}
                {store.pendingCount > 0 && <div className="small muted">{store.pendingCount} Änderung(en) warten auf Abgleich</div>}
              </div>
            </div>
            <div className="row wrap">
              <button className="btn soft" onClick={() => store.sync()}>
                <RefreshCw size={16} /> Jetzt abgleichen
              </button>
              <button className="btn soft" onClick={() => copy(inviteLink, 'Link kopiert – an Partner:in schicken')}>
                <Link2 size={16} /> Link für Partner:in
              </button>
            </div>
            <p className="hint" style={{ margin: 0 }}>
              Der Link enthält die Script-Adresse, aber nicht das Passwort – das gebt ihr auf dem zweiten Handy selbst ein.
            </p>
          </>
        ) : (
          <div className="notice">
            <HardDrive size={18} />
            <div>
              Gerade speichert die App nur auf diesem Gerät. Verbindet Google Drive, damit ihr beide dieselben Rezepte, Pläne und Einkaufslisten seht – und Rezepte per Link importieren könnt.
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="surl">Web-App-URL des Google-Scripts</label>
          <input id="surl" className="input" placeholder="https://script.google.com/macros/s/…/exec" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="spw">Haushalts-Passwort</label>
          <input id="spw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {result && (
          <div className={`notice ${result.ok ? 'ok' : 'err'}`}>
            {result.text}
            {result.folderUrl && (
              <>
                {' '}
                <a href={result.folderUrl} target="_blank" rel="noreferrer">
                  Ordner öffnen
                </a>
              </>
            )}
          </div>
        )}
        <div className="row wrap">
          <button className="btn primary" onClick={connect} disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : <Cloud size={18} />} {store.online ? 'Neu verbinden' : 'Verbinden'}
          </button>
          {store.online && (
            <button
              className="btn ghost"
              onClick={() => {
                if (confirm('Verbindung trennen? Die Daten bleiben in Drive und auf diesem Gerät erhalten.')) store.setConfig(null);
              }}
            >
              Trennen
            </button>
          )}
        </div>
      </section>

      <details className="card collapse" open={!store.online}>
        <summary>Anleitung: Google Drive einrichten (ca. 10 Minuten, am besten am Computer)</summary>
        <div className="card-pad guide stack" style={{ paddingTop: 0 }}>
          <ol>
            <li>
              Öffnet <a href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer">script.google.com</a> mit dem Google-Konto, in dessen Drive die Daten liegen sollen. Es öffnet sich ein neues Projekt – oben links auf „Unbenanntes Projekt“ klicken und in <strong>Kochplaner</strong> umbenennen.
            </li>
            <li>
              Den Beispielcode im Editor komplett löschen, dann den Kochplaner-Code einfügen und speichern (Disketten-Symbol).
              <div style={{ marginTop: 8 }}>
                <button className="btn soft sm" onClick={() => copy(scriptCode, 'Script-Code kopiert')}>
                  <Copy size={14} /> Script-Code kopieren
                </button>
              </div>
            </li>
            <li>
              Links auf das Zahnrad <strong>Projekteinstellungen</strong> → ganz unten <strong>Script-Property hinzufügen</strong>: Property <code>PASSWORT</code>, Wert: euer Haushalts-Passwort → speichern.
            </li>
            <li>
              Zurück zum Editor (Symbol <code>&lt; &gt;</code>). Oben in der Auswahlliste die Funktion <code>einrichten</code> wählen und auf <strong>Ausführen</strong> klicken. Google fragt nach Berechtigungen: Konto wählen → <strong>Erweitert</strong> → <strong>Zu Kochplaner wechseln (unsicher)</strong> → <strong>Zulassen</strong>. Die Warnung ist bei selbst geschriebenen Scripts normal.
            </li>
            <li>
              Oben rechts <strong>Bereitstellen</strong> → <strong>Neue Bereitstellung</strong> → beim Zahnrad „Typ auswählen“ <strong>Web-App</strong> wählen. Ausführen als: <strong>Ich</strong>, Zugriff: <strong>Jeder</strong> → Bereitstellen → die <strong>Web-App-URL</strong> kopieren (endet auf <code>/exec</code>).
            </li>
            <li>URL und Passwort oben eintragen → Verbinden. Auf dem zweiten Handy genauso (oder den „Link für Partner:in“ schicken).</li>
          </ol>
          <p className="hint" style={{ margin: 0 }}>
            Falls das Script später einmal aktualisiert werden muss: Code ersetzen → Bereitstellen → Bereitstellungen verwalten → Stift → Version „Neue Version“ → Bereitstellen. Die URL bleibt gleich.
          </p>
        </div>
      </details>

      <section className="card card-pad stack">
        <h2>Daten</h2>
        <div className="row wrap">
          <button className="btn soft" onClick={exportData}>
            <Download size={16} /> Sicherung herunterladen
          </button>
          <button className="btn soft" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Sicherung einspielen
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importData(e.target.files?.[0])} />
        </div>
        {store.online && <p className="hint" style={{ margin: 0 }}>Zusätzlich legt das Script täglich eine Sicherung im Drive-Ordner „Kochplaner/Backups“ an.</p>}
        {samples.length > 0 && (
          <button
            className="btn danger"
            onClick={() => {
              store.batch(() => samples.forEach((r) => store.remove('recipes', r.id)));
              showToast('Beispielrezepte entfernt');
            }}
          >
            <Trash2 size={16} /> {samples.length} Beispielrezepte entfernen
          </button>
        )}
      </section>

      <p className="tiny muted" style={{ textAlign: 'center' }}>
        Kochplaner · Version {__APP_VERSION__}
      </p>
    </div>
  );
}
