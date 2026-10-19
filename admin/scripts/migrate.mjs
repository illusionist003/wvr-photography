/* One-time: move the galleries that were built into the site (9 galleries,
   36 photos, src/data/collections.ts) into the studio's Blob store so Matthew
   can edit them. Uploads each photo and a 640px thumbnail, then writes the
   first version of content/manifest.json. Refuses to run if content exists.
   Run from admin/: node --env-file=<env> --experimental-strip-types scripts/migrate.mjs */
import { readFileSync } from 'node:fs';
import { put, get } from '@vercel/blob';
import { createRequire } from 'node:module';

const sharp = createRequire(new URL('../../package.json', import.meta.url))('sharp');

const SITE = new URL('../../', import.meta.url).pathname;
const existing = await get('content/manifest.json', { access: 'public', useCache: false });
if (existing && existing.statusCode === 200) {
  console.error('content/manifest.json already exists; not overwriting');
  process.exit(1);
}

const { COLLECTIONS, GROUPS } = await import(SITE + 'src/data/collections.ts');
const photosTs = readFileSync(SITE + 'src/data/photos.ts', 'utf8');
const meta = {};
for (const m of photosTs.matchAll(/'([a-z0-9-]+)': \{ alt: '((?:[^'\\]|\\.)*)', caption: '((?:[^'\\]|\\.)*)' \}/g)) {
  meta[m[1]] = { alt: m[2].replace(/\\'/g, "'"), caption: m[3].replace(/\\'/g, "'") };
}

const now = new Date().toISOString();
const galleries = [];
for (const c of COLLECTIONS) {
  const photos = [];
  for (const key of c.photos) {
    const file = `${SITE}src/assets/photos/${key}.jpg`;
    const buf = readFileSync(file);
    const { width, height } = await sharp(buf).metadata();
    const thumb = await sharp(buf).resize(640, 640, { fit: 'inside' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    const full = await put(`photos/${key}.jpg`, buf, { access: 'public', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true });
    const t = await put(`photos/${key}-t.jpg`, thumb, { access: 'public', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true });
    if (!meta[key]) throw new Error(`no alt/caption for ${key}`);
    photos.push({ key, url: full.url, thumb: t.url, w: width, h: height, alt: meta[key].alt, caption: meta[key].caption });
    process.stdout.write('.');
  }
  galleries.push({ slug: c.slug, title: c.title, kind: c.kind, section: c.group, service: c.service, blurb: c.blurb, visible: true, cover: c.cover, photos, createdAt: now, updatedAt: now });
}

const content = {
  schema: 1,
  version: 1,
  updatedAt: now,
  sections: GROUPS.map((g) => ({ id: g.id, title: g.title, intro: g.intro })),
  galleries,
};
const body = JSON.stringify(content);
await put('content/manifest.json', body, { access: 'public', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60 });
await put('content/history/0000001.json', body, { access: 'public', contentType: 'application/json', addRandomSuffix: true });
console.log(`\nmigrated ${galleries.length} galleries, ${galleries.reduce((n, g) => n + g.photos.length, 0)} photos`);
