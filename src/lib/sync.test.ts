import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, load } from '../../apps-script/mock';
import { Store } from './store';
import type { Recipe } from './types';

const URL_ = 'https://script.google.com/macros/s/test/exec';

/** Route the app's fetch() calls to the Code.gs doPost running in the VM. */
function installFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const out = api.doPost({ postData: { contents: init.body as string } }) as { content: string };
      return new Response(out.content, { status: 200 });
    }),
  );
}

async function device() {
  const s = new Store();
  await s.init({ background: false });
  s.config = { url: URL_, password: 'geheim' };
  s.status = 'idle';
  return s;
}

const recipe = (id: string, title: string): Recipe => ({
  id,
  title,
  batch: 'big',
  effort: 'leicht',
  price: 2,
  carb: 'reis',
  ingredients: [],
  steps: [],
  createdAt: 1,
});

beforeEach(() => {
  load();
  installFetch();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('sync between two phones', () => {
  it('shares recipes, plans and deletions', async () => {
    const a = await device();
    const b = await device();
    a.put('recipes', 'r1', recipe('r1', 'Curry'));
    a.put('plans', '2026-10-19', { week: '2026-10-19', big: 'r1' });
    await a.sync();
    expect(a.pendingCount).toBe(0);

    await b.sync();
    expect(b.get('recipes', 'r1')?.title).toBe('Curry');
    expect(b.get('plans', '2026-10-19')?.big).toBe('r1');

    b.remove('recipes', 'r1');
    await b.sync();
    await a.sync();
    expect(a.get('recipes', 'r1')).toBeUndefined();
  });

  it('keeps both changes when both edit different things at the same time', async () => {
    const a = await device();
    const b = await device();
    a.put('shopcheck', 'w|milch', { checked: true });
    b.put('shopcheck', 'w|brot', { checked: true });
    await a.sync();
    await b.sync();
    await a.sync();
    expect(a.get('shopcheck', 'w|brot')?.checked).toBe(true);
    expect(b.get('shopcheck', 'w|milch')?.checked).toBe(true);
  });

  it('newest edit of the same recipe wins on both phones', async () => {
    const a = await device();
    const b = await device();
    a.put('recipes', 'r', recipe('r', 'Alt'));
    await a.sync();
    await b.sync();

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000);
    b.put('recipes', 'r', recipe('r', 'Neu von B'));
    vi.restoreAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    a.put('recipes', 'r', recipe('r', 'Älter von A'));

    await b.sync();
    await a.sync();
    await b.sync();
    expect(a.get('recipes', 'r')?.title).toBe('Neu von B');
    expect(b.get('recipes', 'r')?.title).toBe('Neu von B');
    expect(a.pendingCount).toBe(0);
  });

  it('keeps working offline and catches up later', async () => {
    const a = await device();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    a.put('recipes', 'x', recipe('x', 'Offline gekocht'));
    await a.sync();
    expect(a.status).toBe('offline');
    expect(a.pendingCount).toBe(1);

    installFetch();
    await a.sync();
    expect(a.status).toBe('idle');
    expect(a.pendingCount).toBe(0);
    const b = await device();
    await b.sync();
    expect(b.get('recipes', 'x')?.title).toBe('Offline gekocht');
  });

  it('moves pictures taken without Drive connection into Drive', async () => {
    const a = await device();
    a.put('recipes', 'p', { ...recipe('p', 'Mit Foto'), image: { url: 'data:image/jpeg;base64,AAEC' } });
    await a.sync();
    const img = a.get('recipes', 'p')?.image;
    expect(img?.driveId).toBeTruthy();
    expect(img?.url).toMatch(/^https:\/\/lh3\.googleusercontent\.com\/d\//);
  });

  it('reports a wrong password', async () => {
    const a = await device();
    a.config = { url: URL_, password: 'falsch' };
    await a.sync();
    expect(a.status).toBe('error');
    expect(a.error).toMatch(/Passwort/);
  });
});
