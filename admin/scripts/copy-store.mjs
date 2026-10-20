/* One-time: copy everything from the old studio's Blob store into a new one,
   so a new copy of the studio starts with every album, gallery (hidden ones
   too), caption and photo. Reads the old store's public manifest, uploads each
   photo and thumbnail into the new store, points the manifest at the new
   copies and writes it as the new store's first version. The old store is
   only read. Refuses to run if the new store already has content.

   Run from admin/, with the NEW store's token in .env.local:
     node --env-file=.env.local scripts/copy-store.mjs [old manifest URL] */
import { head, put } from '@vercel/blob';

const FROM = process.argv[2] || 'https://qwtkyfdljcc15592.public.blob.vercel-storage.com/content/manifest.json';
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN is not set: run `vercel env pull .env.local` in admin/ first');
  process.exit(1);
}
if (await head('content/manifest.json').catch(() => null)) {
  console.error('the new store already has content/manifest.json; not overwriting');
  process.exit(1);
}

const res = await fetch(`${FROM}?t=${Date.now()}`, { cache: 'no-store' });
if (!res.ok) throw new Error(`could not read ${FROM}: ${res.status}`);
const doc = await res.json();
const photos = doc.galleries.flatMap((g) => g.photos);
console.log(`copying ${doc.albums?.length ?? 0} albums, ${doc.galleries.length} galleries, ${photos.length} photos`);

async function copy(url, pathname) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status}`);
      const out = await put(pathname, Buffer.from(await r.arrayBuffer()), { access: 'public', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true });
      return out.url;
    } catch (e) {
      if (attempt >= 3) throw new Error(`${pathname}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

let done = 0;
const todo = photos.slice();
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (todo.length) {
      const p = todo.shift();
      p.url = await copy(p.url, `photos/${p.key}.jpg`);
      p.thumb = await copy(p.thumb, `photos/${p.key}-t.jpg`);
      if (++done % 10 === 0 || done === photos.length) console.log(`  ${done} of ${photos.length}`);
    }
  }),
);

const body = JSON.stringify({ ...doc, version: (Number(doc.version) || 0) + 1, updatedAt: new Date().toISOString() });
await put('content/manifest.json', body, { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 60 });
console.log('done: the new studio now has everything. Sign in and check it before pointing the website at it.');
