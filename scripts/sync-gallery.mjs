/* Before every build: fetch the published galleries from WVR Studio (the
   admin app), save them as src/content/gallery.json, and download any photo
   not already in src/assets/gallery/ (kept between CI runs by the cache).
   Writes public/gallery-version.txt so the studio can tell when the live
   site has caught up.

   STRICT=1 (CI): any failure stops the build, so a hiccup can never publish
   an empty or partial portfolio; the site already live stays live.
   Without STRICT (local): falls back to the saved gallery.json. */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const sharp = createRequire(import.meta.url)('sharp');
const ROOT = new URL('../', import.meta.url).pathname;
const API = process.env.GALLERY_API || 'https://wvr-admin.vercel.app/api/site';
const STRICT = !!process.env.STRICT;
const OUT = `${ROOT}src/content/gallery.json`;
const DIR = `${ROOT}src/assets/gallery/`;

// house style for anything typed in the studio: no long dashes
const tidy = (s) => (typeof s === 'string' ? s.replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2').replace(/\s*[–—]\s*/g, ', ').trim() : '');

let data;
try {
  const r = await fetch(API, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(`${API} answered ${r.status}`);
  data = await r.json();
  if (!Array.isArray(data.galleries) || !Array.isArray(data.sections) || !data.hash) throw new Error('unexpected response');
} catch (e) {
  if (STRICT || !existsSync(OUT)) {
    console.error(`sync-gallery: could not load galleries: ${e.message}`);
    process.exit(1);
  }
  console.warn(`sync-gallery: ${e.message}; building from the saved src/content/gallery.json`);
  data = JSON.parse(readFileSync(OUT, 'utf8'));
}

data.sections = data.sections.map((s) => ({ ...s, title: tidy(s.title), intro: tidy(s.intro) }));
data.galleries = data.galleries.map((g) => ({
  ...g,
  title: tidy(g.title),
  kind: tidy(g.kind),
  blurb: tidy(g.blurb),
  photos: g.photos.map((p) => ({ ...p, alt: tidy(p.alt), caption: tidy(p.caption) })),
}));

mkdirSync(DIR, { recursive: true });
const wanted = new Set();
const todo = [];
for (const g of data.galleries) {
  for (const p of g.photos) {
    wanted.add(`${p.key}.jpg`);
    if (!existsSync(`${DIR}${p.key}.jpg`)) todo.push(p);
  }
}

let done = 0;
async function fetchOne(p) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(p.url);
      if (!r.ok) throw new Error(`${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      // the studio already sends 2400px JPEGs; this only guards against anything bigger
      const out = await sharp(buf).rotate().resize(2400, 2400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      writeFileSync(`${DIR}${p.key}.jpg`, out);
      done++;
      return;
    } catch (e) {
      if (attempt >= 3) throw new Error(`photo ${p.key}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}
const pool = Array.from({ length: 6 }, async () => {
  while (todo.length) await fetchOne(todo.shift());
});
await Promise.all(pool);

let removed = 0;
for (const f of readdirSync(DIR)) {
  if (!wanted.has(f)) {
    rmSync(`${DIR}${f}`);
    removed++;
  }
}

writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n');
writeFileSync(`${ROOT}public/gallery-version.txt`, `${data.hash}\n`);
console.log(`sync-gallery: ${data.galleries.length} galleries, ${wanted.size} photos (${done} downloaded, ${removed} removed), version ${data.hash}`);
