import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Dices,
  Leaf,
  ListChecks,
  Lock,
  LockOpen,
  Plus,
  Refrigerator,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { navigate, useApp } from '../AppState';
import { RecipeBadges, RecipeImage } from '../components/ui';
import { RecipePicker } from '../components/RecipePicker';
import { addWeeks, isoWeekNumber, planningWeek, toISODate, mondayOf, weekMonth, weekRangeLabel, weeksBetween } from '../lib/dates';
import { useCollection } from '../lib/hooks';
import { ingredientKey } from '../lib/ingredients';
import { PRODUCE, produceInSeason } from '../lib/season';
import { explain, shuffleWeek, type ShuffleContext, type Slot } from '../lib/shuffle';
import { sampleRecipes } from '../lib/samples';
import { store } from '../lib/store';
import type { Effort, Price, Recipe, WeekPlan } from '../lib/types';

const ROLL_MS = 1100;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function weekRelative(week: string): string {
  const diff = weeksBetween(toISODate(mondayOf(new Date())), week);
  if (diff === 0) return 'Diese Woche';
  if (diff === 1) return 'Nächste Woche';
  if (diff === -1) return 'Letzte Woche';
  return diff > 0 ? `In ${diff} Wochen` : `Vor ${-diff} Wochen`;
}

export function WeekView() {
  const { week, setWeek, filters, setFilters, seen, addSeen, picks, setPick } = useApp();
  const recipes = useCollection('recipes');
  const plans = useCollection('plans');
  const pantryDocs = useCollection('pantry');
  const pantry = useMemo(() => pantryDocs.map((p) => p.name), [pantryDocs]);
  const plan: WeekPlan = plans.find((p) => p.week === week) ?? { week };
  const month = weekMonth(week);
  const [rolling, setRolling] = useState<Record<Slot, boolean>>({ big: false, small: false });
  const [picker, setPicker] = useState<Slot | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const ctx: ShuffleContext = { recipes, plans, week, pantry, filters };
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const pools = useMemo(
    () => ({ big: recipes.filter((r) => r.batch === 'big'), small: recipes.filter((r) => r.batch === 'small') }),
    [recipes],
  );

  const shuffle = (only?: Slot) => {
    if (rolling.big || rolling.small) return;
    const res = shuffleWeek(ctx, plan, only, { big: seen[`${week}|big`], small: seen[`${week}|small`] });
    const slots = (['big', 'small'] as Slot[]).filter((s) => s in res.picks);
    if (!slots.length) return;
    const finish = () => {
      store.put('plans', week, res.plan);
      for (const s of slots) {
        setPick(week, s, res.picks[s]);
        const id = res.plan[s];
        if (id) addSeen(week, s, id);
      }
      setRolling({ big: false, small: false });
    };
    if (reducedMotion()) return finish();
    setRolling({ big: slots.includes('big'), small: slots.includes('small') });
    setTimeout(finish, ROLL_MS);
  };

  const toggleLock = (slot: Slot) => {
    const key = slot === 'big' ? 'lockBig' : 'lockSmall';
    store.put('plans', week, { ...plan, [key]: !plan[key] });
  };

  const choose = (slot: Slot, r: Recipe | null) => {
    const next = { ...plan };
    if (r) next[slot] = r.id;
    else delete next[slot];
    store.put('plans', week, next);
    setPick(week, slot, undefined);
    setPicker(null);
  };

  const filterCount = (filters.maxEffort ? 1 : 0) + (filters.maxPrice ? 1 : 0);
  const bothLocked = !!plan.lockBig && !!plan.lockSmall;
  const hasPlan = !!plan.big || !!plan.small;

  if (recipes.length === 0) {
    return (
      <div className="page">
        <WeekSwitch week={week} setWeek={setWeek} />
        <div className="card empty">
          <div className="big-emoji">🎲</div>
          <h2>Noch keine Rezepte</h2>
          <p>Legt eure Lieblingsrezepte an – per Link, Text oder von Hand. Danach würfelt die App euch die Woche zusammen.</p>
          <button className="btn primary" onClick={() => navigate({ name: 'neu' })}>
            <Plus size={18} /> Erstes Rezept hinzufügen
          </button>
          <button
            className="btn soft"
            onClick={() => store.batch(() => sampleRecipes().forEach((r) => store.put('recipes', r.id, r)))}
          >
            <Sparkles size={18} /> Mit Beispielrezepten ausprobieren
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <WeekSwitch week={week} setWeek={setWeek} />

      <button
        className={`btn accent lg block shuffle-btn ${rolling.big || rolling.small ? 'rolling' : ''}`}
        onClick={() => shuffle()}
        disabled={bothLocked}
      >
        <Dices size={26} />
        {hasPlan ? 'Neu würfeln' : 'Woche würfeln'}
      </button>

      <div className="row">
        <button className={`btn sm ${filterCount ? 'primary' : 'soft'}`} onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal size={16} /> Filter{filterCount ? ` (${filterCount})` : ''}
        </button>
        {pantry.length > 0 && (
          <span className="small muted row" style={{ gap: 4 }}>
            <Refrigerator size={15} /> {pantry.length} Zutat{pantry.length > 1 ? 'en' : ''} im Vorrat
          </span>
        )}
      </div>

      {showFilters && (
        <div className="card card-pad filters">
          <div className="filter-row">
            <span>Aufwand</span>
            <div className="chips">
              {(
                [
                  [undefined, 'Egal'],
                  ['mittel', 'Höchstens mittel'],
                  ['leicht', 'Nur leicht'],
                ] as [Effort | undefined, string][]
              ).map(([v, label]) => (
                <button key={label} className={`chip ${filters.maxEffort === v ? 'on' : ''}`} onClick={() => setFilters({ ...filters, maxEffort: v })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-row">
            <span>Preis</span>
            <div className="chips">
              {(
                [
                  [undefined, 'Egal'],
                  [3, 'Bis €€€'],
                  [2, 'Bis €€'],
                ] as [Price | undefined, string][]
              ).map(([v, label]) => (
                <button key={label} className={`chip ${filters.maxPrice === v ? 'on' : ''}`} onClick={() => setFilters({ ...filters, maxPrice: v })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(['big', 'small'] as Slot[]).map((slot) => {
        const recipe = plan[slot] ? byId.get(plan[slot]!) : undefined;
        const pick = picks[`${week}|${slot}`];
        const fromShuffle = pick && recipe && pick.recipe.id === recipe.id;
        const reasons = recipe ? (fromShuffle ? pick.reasons : explain(recipe, ctx)) : [];
        return (
          <SlotCard
            key={slot}
            slot={slot}
            recipe={recipe}
            reasons={reasons}
            relaxed={fromShuffle ? pick.relaxed : undefined}
            noResult={pick === null}
            locked={slot === 'big' ? !!plan.lockBig : !!plan.lockSmall}
            rolling={rolling[slot]}
            pool={pools[slot]}
            month={month}
            onShuffle={() => shuffle(slot)}
            onLock={() => toggleLock(slot)}
            onPick={() => setPicker(slot)}
          />
        );
      })}

      <PantryCard pantry={pantry} month={month} />

      {picker && (
        <RecipePicker
          recipes={recipes}
          batch={picker}
          month={month}
          onPick={(r) => choose(picker, r)}
          onClear={plan[picker] ? () => choose(picker, null) : undefined}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function WeekSwitch({ week, setWeek }: { week: string; setWeek: (w: string) => void }) {
  const isPlanning = week === planningWeek();
  return (
    <div className="week-switch">
      <button className="icon-btn solid" onClick={() => setWeek(addWeeks(week, -1))} aria-label="Vorherige Woche">
        <ChevronLeft size={20} />
      </button>
      <button className="week-label btn ghost" style={{ flexDirection: 'column', gap: 0 }} onClick={() => setWeek(planningWeek())} title="Zur Planungswoche">
        <strong>
          KW {isoWeekNumber(week)} · {weekRangeLabel(week)}
        </strong>
        <span className="small muted">
          {weekRelative(week)}
          {!isPlanning && ' · zurück'}
        </span>
      </button>
      <button className="icon-btn solid" onClick={() => setWeek(addWeeks(week, 1))} aria-label="Nächste Woche">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function SlotCard({
  slot,
  recipe,
  reasons,
  relaxed,
  noResult,
  locked,
  rolling,
  pool,
  month,
  onShuffle,
  onLock,
  onPick,
}: {
  slot: Slot;
  recipe?: Recipe;
  reasons: string[];
  relaxed?: string;
  noResult: boolean;
  locked: boolean;
  rolling: boolean;
  pool: Recipe[];
  month: number;
  onShuffle: () => void;
  onLock: () => void;
  onPick: () => void;
}) {
  const [reel, setReel] = useState<Recipe | undefined>();
  const [landed, setLanded] = useState(false);
  const wasRolling = useRef(false);

  // Slot machine: flick through random recipes, slowing down
  useEffect(() => {
    if (!rolling || pool.length === 0) return;
    let cancelled = false;
    let delay = 55;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (cancelled) return;
      setReel(pool[Math.floor(Math.random() * pool.length)]);
      delay *= 1.18;
      t = setTimeout(tick, delay);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [rolling, pool]);

  useEffect(() => {
    if (wasRolling.current && !rolling) {
      setLanded(true);
      const t = setTimeout(() => setLanded(false), 500);
      wasRolling.current = false;
      return () => clearTimeout(t);
    }
    wasRolling.current = rolling;
  }, [rolling]);

  const shown = rolling ? reel ?? recipe : recipe;
  const isBig = slot === 'big';
  const open = () => recipe && !rolling && navigate({ name: 'rezept', id: recipe.id });

  return (
    <section className={`card slot ${rolling ? 'rolling' : ''} ${landed ? 'landed' : ''}`} aria-busy={rolling}>
      <div className="slot-head">
        <span className={`slot-kind ${slot}`}>{isBig ? 'Big Batch' : 'Small Batch'}</span>
        <span className="slot-when">· {isBig ? 'Meal-Prep für Mo–Fr' : 'Fürs Wochenende'}</span>
      </div>

      {shown ? (
        <>
          <div className="slot-media" onClick={open}>
            <RecipeImage recipe={shown} />
            {locked && (
              <span className="lock-flag">
                <Lock size={12} /> Festgehalten
              </span>
            )}
          </div>
          <div className="slot-body">
            <div className="slot-title" onClick={open}>
              {shown.title}
            </div>
            {!rolling && (
              <>
                <RecipeBadges recipe={shown} month={month} />
                {(reasons.length > 0 || relaxed) && (
                  <div className="reasons">
                    {reasons.map((r) => (
                      <span key={r} className="reason">
                        {r.startsWith('Saison') ? <Leaf size={14} /> : r.startsWith('Habt') || r.startsWith('Flex') ? <Refrigerator size={14} /> : <Sparkles size={14} />}
                        {r}
                      </span>
                    ))}
                    {relaxed && (
                      <span className="reason warn">
                        <AlertTriangle size={14} />
                        {relaxed}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="slot-empty">
          {pool.length === 0 ? (
            <>
              <span>Noch keine {isBig ? 'Big-Batch' : 'Small-Batch'}-Rezepte.</span>
              <button className="btn sm soft" onClick={() => navigate({ name: 'neu' })}>
                <Plus size={16} /> Rezept hinzufügen
              </button>
            </>
          ) : noResult ? (
            <span>Kein Rezept passt zu den Filtern.</span>
          ) : (
            <span>Noch nichts geplant – einfach würfeln.</span>
          )}
        </div>
      )}

      <div className="slot-actions">
        <button className="btn sm soft" onClick={onShuffle} disabled={locked || rolling || pool.length === 0}>
          <Shuffle size={16} /> Neu
        </button>
        <button className={`btn sm soft ${locked ? 'on' : ''}`} onClick={onLock} disabled={!recipe || rolling}>
          {locked ? <Lock size={16} /> : <LockOpen size={16} />} {locked ? 'Fest' : 'Festhalten'}
        </button>
        <button className="btn sm soft" onClick={onPick} disabled={rolling}>
          <ListChecks size={16} /> Wählen
        </button>
      </div>
    </section>
  );
}

const STAPLES = ['Zwiebeln', 'Knoblauch', 'Kartoffeln', 'Möhren', 'Paprika', 'Champignons', 'Feta', 'Mozzarella', 'Parmesan', 'Joghurt', 'Sahne', 'Eier', 'Tofu', 'Halloumi', 'Hackfleisch', 'Hähnchen', 'Lachs', 'Kokosmilch', 'Kichererbsen'];

function PantryCard({ pantry, month }: { pantry: string[]; month: number }) {
  const [text, setText] = useState('');
  const suggestions = useMemo(() => {
    const have = new Set(pantry.map(ingredientKey));
    return produceInSeason(month, 'gemuese')
      .map((p) => p.name)
      .filter((n) => !have.has(ingredientKey(n)))
      .slice(0, 8);
  }, [pantry, month]);
  const allNames = useMemo(() => [...new Set([...PRODUCE.map((p) => p.name), ...STAPLES])].sort((a, b) => a.localeCompare(b, 'de')), []);

  const add = (name: string) => {
    const n = name.trim();
    if (!n) return;
    const key = ingredientKey(n) || n.toLowerCase();
    store.put('pantry', key, { name: n });
    setText('');
  };

  const clearAll = () => store.batch(() => store.entries('pantry').forEach(([id]) => store.remove('pantry', id)));

  return (
    <section className="card card-pad stack">
      <div className="row">
        <Refrigerator size={20} className="muted" />
        <h3 style={{ flex: 1 }}>Was haben wir da?</h3>
        {pantry.length > 0 && (
          <button className="btn ghost sm" onClick={clearAll}>
            Leeren
          </button>
        )}
      </div>
      <p className="hint" style={{ margin: 0 }}>
        Rezepte mit diesen Zutaten werden beim Würfeln bevorzugt – Gerichte mit flexiblem Gemüse passen zu jedem Gemüse. Was da ist, kommt nicht auf die Einkaufsliste.
      </p>
      <form
        className="pantry-input"
        onSubmit={(e) => {
          e.preventDefault();
          add(text);
        }}
      >
        <input className="input" list="pantry-suggest" placeholder="z. B. Brokkoli, Feta …" value={text} onChange={(e) => setText(e.target.value)} />
        <datalist id="pantry-suggest">
          {allNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <button className="btn primary" type="submit" aria-label="Hinzufügen">
          <Plus size={18} />
        </button>
      </form>
      {pantry.length > 0 && (
        <div className="chips">
          {store.entries('pantry').map(([id, p]) => (
            <button key={id} className="chip on" onClick={() => store.remove('pantry', id)} aria-label={`${p.name} entfernen`}>
              {p.name} <X size={14} className="x" />
            </button>
          ))}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="tiny muted">Gerade Saison – schnell hinzufügen:</span>
          <div className="chips">
            {suggestions.map((s) => (
              <button key={s} className="chip minor" onClick={() => add(s)}>
                <Plus size={13} /> {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
