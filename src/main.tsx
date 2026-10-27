import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppStateProvider } from './AppState';
import { store } from './lib/store';
import { applyFontSize } from './lib/prefs';
import { updateStoredStarterRecipes } from './lib/samples';
import './styles.css';

applyFontSize();
store.afterSync = updateStoredStarterRecipes;
void store.init().then(updateStoredStarterRecipes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStateProvider>
      <App />
    </AppStateProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
