import { BookOpen, CalendarDays, Cloud, CloudOff, HardDrive, Leaf, RefreshCw, Settings, ShoppingBasket, UtensilsCrossed } from 'lucide-react';
import { navigate, useApp, type Route } from './AppState';
import { Toast } from './components/ui';
import { useStoreVersion } from './lib/hooks';
import { store } from './lib/store';
import { WeekView } from './views/WeekView';
import { RecipesView } from './views/RecipesView';
import { RecipeDetail } from './views/RecipeDetail';
import { RecipeEditor } from './views/RecipeEditor';
import { AddRecipe } from './views/AddRecipe';
import { ShoppingView } from './views/ShoppingView';
import { SeasonView } from './views/SeasonView';
import { SettingsView } from './views/SettingsView';

const TABS: { route: Route['name']; label: string; icon: typeof CalendarDays }[] = [
  { route: 'woche', label: 'Woche', icon: CalendarDays },
  { route: 'rezepte', label: 'Rezepte', icon: BookOpen },
  { route: 'einkauf', label: 'Einkauf', icon: ShoppingBasket },
  { route: 'saison', label: 'Saison', icon: Leaf },
];

const TITLES: Partial<Record<Route['name'], string>> = {
  rezepte: 'Rezepte',
  einkauf: 'Einkauf',
  saison: 'Saison',
  einstellungen: 'Einstellungen',
};

function activeTab(r: Route): Route['name'] {
  if (r.name === 'rezept' || r.name === 'bearbeiten' || r.name === 'neu') return 'rezepte';
  return r.name;
}

function SyncButton() {
  useStoreVersion();
  const s = store.status;
  const Icon = s === 'local' ? HardDrive : s === 'syncing' ? RefreshCw : s === 'offline' || s === 'error' ? CloudOff : Cloud;
  const label =
    s === 'local'
      ? 'Nur auf diesem Gerät gespeichert'
      : s === 'syncing'
        ? 'Gleiche ab …'
        : s === 'idle'
          ? 'Mit Google Drive abgeglichen'
          : (store.error ?? 'Nicht abgeglichen');
  return (
    <button
      className="icon-btn sync-dot"
      data-status={s}
      title={label}
      aria-label={label}
      onClick={() => (s === 'local' || s === 'error' ? navigate({ name: 'einstellungen' }) : store.sync())}
    >
      <Icon size={20} className={s === 'syncing' ? 'spin' : ''} />
    </button>
  );
}

export function App() {
  const { route, toast, showToast } = useApp();
  const tab = activeTab(route);
  const fullBleed = route.name === 'rezept';

  let view;
  switch (route.name) {
    case 'woche':
      view = <WeekView />;
      break;
    case 'rezepte':
      view = <RecipesView />;
      break;
    case 'rezept':
      view = <RecipeDetail key={route.id} id={route.id} />;
      break;
    case 'bearbeiten':
      view = <RecipeEditor key={route.id} id={route.id} />;
      break;
    case 'neu':
      view = <AddRecipe />;
      break;
    case 'einkauf':
      view = <ShoppingView />;
      break;
    case 'saison':
      view = <SeasonView />;
      break;
    case 'einstellungen':
      view = <SettingsView />;
      break;
  }

  return (
    <div className="app">
      {!fullBleed && route.name !== 'bearbeiten' && route.name !== 'neu' && (
        <header className="topbar">
          {route.name === 'woche' ? (
            <div className="brand">
              <span className="brand-mark">
                <UtensilsCrossed size={19} />
              </span>
              <h1>Kochplaner</h1>
            </div>
          ) : (
            <h1>{TITLES[route.name]}</h1>
          )}
          <SyncButton />
          <button className="icon-btn" onClick={() => navigate({ name: 'einstellungen' })} aria-label="Einstellungen">
            <Settings size={20} />
          </button>
        </header>
      )}
      <main>{view}</main>
      <nav className="bottomnav">
        <div className="bottomnav-inner">
          {TABS.map((t) => (
            <button
              key={t.route}
              className={`navbtn ${tab === t.route ? 'active' : ''}`}
              onClick={() => navigate({ name: t.route } as Route)}
              aria-current={tab === t.route ? 'page' : undefined}
            >
              <span className="pill">
                <t.icon size={21} />
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      {toast && <Toast message={toast} onDone={() => showToast(null)} />}
    </div>
  );
}
