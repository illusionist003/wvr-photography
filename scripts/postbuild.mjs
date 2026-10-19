/* After `astro build`:
   1. drop the full-size originals Astro copies into dist (no page links to them);
   2. check every page against the house rules and fail the build on a miss.
   Run by `npm run build`.
   Text Matthew types in WVR Studio (gallery titles, descriptions, captions,
   sections) is his to write: it is taken out of the page before the copy rules
   run, so a price or a date range in a caption can never block his publish.
   Structure rules (links, image sizes, one h1, titles) still apply. */
import { readdirSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const BASE = (process.env.BASE_PATH || '/').replace(/\/$/, '');

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const gallery = JSON.parse(readFileSync(new URL('../src/content/gallery.json', import.meta.url), 'utf8'));
const USER_TEXT = [
  ...gallery.sections.flatMap((s) => [s.title, s.intro]),
  ...gallery.galleries.flatMap((g) => [g.title, g.kind, g.blurb, ...g.photos.flatMap((p) => [p.caption, p.alt])]),
]
  .filter((t) => t && t.length > 1)
  .sort((a, b) => b.length - a.length);
const decodeText = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ');
const withoutUserText = (s) => USER_TEXT.reduce((acc, t) => acc.split(t).join(' '), s);

const files = walk(DIST);
const pages = files.filter((f) => f.endsWith('.html'));
const html = Object.fromEntries(pages.map((f) => [f, readFileSync(f, 'utf8')]));
const allHtml = Object.values(html).join('\n');

// 1. originals
let dropped = 0;
let bytes = 0;
for (const f of files) {
  const name = f.split('/').pop();
  if (!f.includes('/_astro/') || !/\.(jpg|jpeg|png)$/.test(name)) continue;
  if (allHtml.includes(name)) continue;
  bytes += statSync(f).size;
  rmSync(f);
  dropped++;
}

// 2. rules
const problems = [];
const flag = (page, msg) => problems.push(`${relative(DIST, page)}: ${msg}`);

const FORBIDDEN = [
  [/[–—]/, 'en or em dash'],
  [/#1\b|number one\b|best (photographer|in michigan|in fenton)/i, 'a ranking claim'],
  [/\$\s?\d/, 'a price (none are confirmed, see docs/OPEN-QUESTIONS.md)'],
  [/\b(guarantee|guaranteed)\b/i, 'a guarantee'],
  [/\b(within|in) \d+ (hours?|days?|weeks?)\b/i, 'a turnaround promise'],
  [/\b(award[- ]winning|years of experience|\d+\+? (clients|events|shoots))\b/i, 'an unverified credential'],
  [/lorem ipsum|TODO|TBD\b/i, 'placeholder text'],
];

for (const [page, src] of Object.entries(html)) {
  const body = src.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ');
  const text = withoutUserText(decodeText(body.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' '));
  for (const [re, what] of FORBIDDEN) {
    const m = text.match(re);
    if (m) flag(page, `${what}: "…${text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}…"`);
  }
  // the phone number is always something a thumb can tap
  const unlinked = withoutUserText(decodeText(body.replace(/<a\b[\s\S]*?<\/a>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' '));
  if (/\(248\) 759-1578/.test(unlinked)) flag(page, 'the phone number appears as plain text, not a link');
  const h1 = body.match(/<h1[\s>]/g) || [];
  if (h1.length !== 1) flag(page, `${h1.length} h1 elements`);
  const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
  const title = decode((src.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
  if (title.length < 25 || title.length > 70) flag(page, `title is ${title.length} characters (want 25 to 70): ${title}`);
  const desc = decode((src.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
  if (desc.length < 70 || desc.length > 165) flag(page, `description is ${desc.length} characters (want 70 to 165)`);
  for (const img of body.match(/<img\b[^>]*>/g) || []) {
    if (!/\salt[=\s>]/.test(img)) flag(page, `image without alt: ${img.slice(0, 80)}`);
    if (!/\bwidth=/.test(img) || !/\bheight=/.test(img)) flag(page, `image without width and height: ${img.slice(0, 80)}`);
  }
  // ids are unique on a page
  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) flag(page, `duplicate ids: ${[...new Set(dup)].join(', ')}`);
  // internal links resolve to a built page or file
  for (const m of body.matchAll(/\bhref="([^"#?]+)[^"]*"/g)) {
    const url = m[1];
    if (/^(https?:|tel:|sms:|mailto:|data:)/.test(url)) continue;
    if (BASE && !url.startsWith(BASE + '/')) {
      flag(page, `link escapes the base path: ${url}`);
      continue;
    }
    const path = url.slice(BASE.length);
    const target = join(DIST, path.endsWith('/') ? `${path}index.html` : path);
    if (!existsSync(target)) flag(page, `broken link: ${url}`);
  }
  // in-page anchors point at something on the page
  for (const m of body.matchAll(/\bhref="#([^"]+)"/g)) {
    if (!ids.includes(m[1])) flag(page, `anchor #${m[1]} has no target on the page`);
  }
}

console.log(`postbuild: ${pages.length} pages, removed ${dropped} unused originals (${(bytes / 1e6).toFixed(1)} MB)`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n` + problems.map((p) => '  ' + p).join('\n'));
  if (!process.env.AUDIT_SOFT) process.exit(1);
} else {
  console.log('postbuild: every page passes the house rules');
}
