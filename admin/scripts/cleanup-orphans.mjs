/* Deletes uploaded photos that no gallery uses any more: not in the current
   content, not in any saved version from the last 30 days, and older than
   --min-age-hours (default 24, so an album mid-upload is never touched).
   Dry run unless --delete is given.
   Run from admin/: node --env-file=<env> scripts/cleanup-orphans.mjs [--delete] [--min-age-hours 24] */
import { del, head, list } from '@vercel/blob';

const args = process.argv.slice(2);
const doDelete = args.includes('--delete');
const minAge = Number(args[args.indexOf('--min-age-hours') + 1]) || 24;

async function all(prefix) {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

const used = new Set();
const addUrls = (doc) => doc.galleries.forEach((g) => g.photos.forEach((p) => (used.add(p.url), used.add(p.thumb))));
// head() is never cached; the ETag in the query keeps the CDN from serving an older copy
const meta = await head('content/manifest.json');
addUrls(await (await fetch(`${meta.url}?v=${encodeURIComponent(meta.etag.replace(/\W/g, ''))}`)).json());
const monthAgo = Date.now() - 30 * 864e5;
for (const h of await all('content/history/')) {
  if (new Date(h.uploadedAt).getTime() < monthAgo) continue;
  addUrls(await (await fetch(h.url)).json());
}

const cutoff = Date.now() - minAge * 3600e3;
const orphans = (await all('photos/')).filter((b) => !used.has(b.url) && new Date(b.uploadedAt).getTime() < cutoff);
const mb = orphans.reduce((n, b) => n + b.size, 0) / 1e6;
console.log(`${orphans.length} unused photo files (${mb.toFixed(1)} MB)`);
orphans.forEach((b) => console.log('  ' + b.pathname));
if (doDelete && orphans.length) {
  await del(orphans.map((b) => b.url));
  console.log('deleted');
}
