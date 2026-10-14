// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { api, drive, fetchResponses, load, MockBlob, props } from './mock';

function post(body: Record<string, unknown>, password = 'geheim') {
  const out = api.doPost({ postData: { contents: JSON.stringify({ password, ...body }) } }) as { content: string };
  return JSON.parse(out.content);
}

beforeEach(load);

describe('Code.gs', () => {
  it('rejects wrong passwords and missing configuration', () => {
    expect(post({ op: 'ping' }, 'falsch')).toEqual({ ok: false, error: 'unauthorized' });
    props.delete('PASSWORT');
    expect(post({ op: 'ping' })).toEqual({ ok: false, error: 'no_password' });
  });

  it('creates the Drive folder on first use', () => {
    const res = post({ op: 'ping' });
    expect(res.ok).toBe(true);
    expect(drive.root.folders.map((f) => f.name)).toEqual(['Kochplaner']);
  });

  it('syncs documents between two devices with last-writer-wins', () => {
    const a1 = post({ op: 'sync', since: 0, changes: [{ coll: 'recipes', id: 'r1', data: { title: 'Spätzle' }, updatedAt: 100 }] });
    expect(a1.rev).toBe(1);
    expect(a1.docs).toHaveLength(1);

    // device B starts from scratch and gets everything
    const b1 = post({ op: 'sync', since: 0, changes: [] });
    expect(b1.docs[0].data.title).toBe('Spätzle');

    // B edits, A sends an older edit afterwards -> B's version stays and A is told
    post({ op: 'sync', since: b1.rev, changes: [{ coll: 'recipes', id: 'r1', data: { title: 'Käsespätzle' }, updatedAt: 200 }] });
    const a2 = post({ op: 'sync', since: a1.rev, changes: [{ coll: 'recipes', id: 'r1', data: { title: 'Alt' }, updatedAt: 150 }] });
    expect(a2.docs.find((d: { id: string }) => d.id === 'r1').data.title).toBe('Käsespätzle');

    // deletions are tombstones
    const del = post({ op: 'sync', since: a2.rev, changes: [{ coll: 'recipes', id: 'r1', deleted: true, updatedAt: 300 }] });
    expect(del.docs[0]).toMatchObject({ deleted: true, data: null });

    // only newer revisions are sent
    expect(post({ op: 'sync', since: del.rev, changes: [] }).docs).toEqual([]);
  });

  it('stores umlauts safely and keeps a daily backup', () => {
    post({ op: 'sync', since: 0, changes: [{ coll: 'recipes', id: 'r', data: { title: 'Kürbis-Möhren-Suppe 🎃' }, updatedAt: 1 }] });
    const kp = drive.root.folders[0];
    const dataFile = kp.files.find((f) => f.name === 'kochplaner-daten.json')!;
    expect(dataFile.getBlob().getDataAsString()).not.toMatch(/[^\x00-\x7f]/);
    expect(post({ op: 'sync', since: 0, changes: [] }).docs[0].data.title).toBe('Kürbis-Möhren-Suppe 🎃');
    const backups = kp.folders.find((f) => f.name === 'Backups')!;
    expect(backups.files).toHaveLength(1);
  });

  it('uploads images, shares them by link and serves only own images', () => {
    const png = Buffer.from('fakepng').toString('base64');
    const up = post({ op: 'upload', base64: png, mimeType: 'image/png', name: 'curry.png' });
    expect(up.ok).toBe(true);
    expect(up.url).toBe(`https://lh3.googleusercontent.com/d/${up.id}`);
    expect(drive.files.get(up.id)!.sharing).toBe('ANYONE_WITH_LINK');

    expect(post({ op: 'image', id: up.id })).toMatchObject({ ok: true, mimeType: 'image/png', base64: png });
    expect(post({ op: 'upload', base64: png, mimeType: 'text/html' }).error).toBe('bad_type');

    // a file outside the Bilder folder is not readable
    const other = drive.root.createFile('privat.txt', 'geheim', 'text/plain');
    expect(post({ op: 'image', id: other.id }).error).toBe('not_found');
    post({ op: 'deleteImage', id: other.id });
    expect(other.trashed).toBe(false);
    post({ op: 'deleteImage', id: up.id });
    expect(drive.files.get(up.id)!.trashed).toBe(true);
  });

  it('fetches recipe pages and remote images', () => {
    fetchResponses.set('https://www.chefkoch.de/rezepte/1', { code: 200, text: '<html>Rezept</html>' });
    expect(post({ op: 'fetch', url: 'https://www.chefkoch.de/rezepte/1' })).toMatchObject({ ok: true, status: 200, body: '<html>Rezept</html>' });
    expect(post({ op: 'fetch', url: 'file:///etc/passwd' }).error).toBe('bad_url');

    fetchResponses.set('https://img.example/a.jpg', { code: 200, blob: new MockBlob([1, 2, 3], 'image/jpeg') });
    const saved = post({ op: 'saveImageUrl', url: 'https://img.example/a.jpg', name: 'a' });
    expect(saved.ok).toBe(true);
    fetchResponses.set('https://img.example/x', { code: 200, text: '<html>' });
    expect(post({ op: 'saveImageUrl', url: 'https://img.example/x' }).error).toBe('bad_type');
  });

  it('answers unknown operations and bad JSON gracefully', () => {
    expect(post({ op: 'quatsch' }).error).toBe('unknown_op');
    const out = api.doPost({ postData: { contents: '{nope' } }) as { content: string };
    expect(JSON.parse(out.content).error).toBe('bad_request');
  });
});
