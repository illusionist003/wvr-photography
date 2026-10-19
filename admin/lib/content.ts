/* The studio's content: sections (groups on the portfolio page) and galleries
   with their photos. One JSON file in the Blob store, written with an ETag
   check so two devices can never silently overwrite each other, plus a copy
   of every saved version under content/history/ for recovery.

   The public site only ever sees the published projection (published()):
   visible galleries with at least one photo, and the sections they sit in. */
import { createHash } from 'node:crypto';
import { del, get, list, put, BlobPreconditionFailedError } from '@vercel/blob';

export const SERVICES = ['events', 'products', 'portraits'] as const;
export type Service = (typeof SERVICES)[number];

export interface Photo {
  key: string;
  url: string;
  thumb: string;
  w: number;
  h: number;
  alt: string;
  caption: string;
}

export interface Gallery {
  slug: string;
  title: string;
  kind: string;
  section: string;
  service: Service;
  blurb: string;
  visible: boolean;
  cover: string;
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  title: string;
  intro: string;
}

export interface Content {
  schema: 1;
  version: number;
  updatedAt: string;
  sections: Section[];
  galleries: Gallery[];
}

const PATH = 'content/manifest.json';
const HISTORY = 'content/history/';
const KEEP_HISTORY = 80;

export async function readContent(): Promise<{ content: Content | null; etag: string | null }> {
  const res = await get(PATH, { access: 'public', useCache: false });
  if (!res || res.statusCode !== 200) return { content: null, etag: null };
  const text = await new Response(res.stream).text();
  return { content: JSON.parse(text) as Content, etag: res.blob.etag };
}

export class Conflict extends Error {}

export async function writeContent(next: Content, etag: string | null): Promise<{ etag: string }> {
  const body = JSON.stringify(next);
  try {
    const out = await put(PATH, body, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
      ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
    });
    // a copy of this version, then trim the oldest copies
    await put(`${HISTORY}${String(next.version).padStart(7, '0')}.json`, body, { access: 'public', contentType: 'application/json', addRandomSuffix: true });
    pruneHistory().catch(() => {});
    return { etag: out.etag };
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError) throw new Conflict('changed elsewhere');
    if (!etag && e instanceof Error && /already exists/i.test(e.message)) throw new Conflict('changed elsewhere');
    throw e;
  }
}

async function pruneHistory() {
  const all = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: HISTORY, cursor, limit: 1000 });
    all.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  if (all.length <= KEEP_HISTORY) return;
  all.sort((a, b) => a.pathname.localeCompare(b.pathname));
  await del(all.slice(0, all.length - KEEP_HISTORY).map((b) => b.url));
}

/* ---------- validation ---------- */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function photoUrl(v: unknown): string {
  if (typeof v !== 'string') throw new Error('photo url missing');
  const u = new URL(v);
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.public.blob.vercel-storage.com') || !u.pathname.startsWith('/photos/')) throw new Error('photo url not in the store');
  return u.toString();
}

/** Clean an incoming document from the editor. Throws on anything structural. */
export function clean(input: unknown): Omit<Content, 'version' | 'updatedAt'> {
  const doc = input as Partial<Content>;
  if (!doc || !Array.isArray(doc.sections) || !Array.isArray(doc.galleries)) throw new Error('bad document');
  if (doc.sections.length > 20 || doc.galleries.length > 300) throw new Error('too many items');

  const sections: Section[] = doc.sections.map((s) => {
    const id = str(s?.id, 40);
    if (!SLUG.test(id)) throw new Error(`bad section id ${id}`);
    return { id, title: str(s.title, 60) || 'Untitled section', intro: str(s.intro, 220) };
  });
  const sectionIds = new Set(sections.map((s) => s.id));
  if (sectionIds.size !== sections.length) throw new Error('duplicate section');
  if (!sections.length) throw new Error('at least one section');

  const slugs = new Set<string>();
  const galleries: Gallery[] = doc.galleries.map((g) => {
    const slug = str(g?.slug, 60);
    if (!SLUG.test(slug) || slugs.has(slug)) throw new Error(`bad or duplicate gallery address ${slug}`);
    slugs.add(slug);
    if (!Array.isArray(g.photos) || g.photos.length > 600) throw new Error('bad photo list');
    const keys = new Set<string>();
    const photos: Photo[] = g.photos.map((p) => {
      const key = str(p?.key, 60);
      if (!KEY.test(key) || keys.has(key)) throw new Error(`bad photo ${key}`);
      keys.add(key);
      const w = Math.round(Number(p.w));
      const h = Math.round(Number(p.h));
      if (!(w > 0 && h > 0 && w <= 10000 && h <= 10000)) throw new Error(`bad size for ${key}`);
      return { key, url: photoUrl(p.url), thumb: photoUrl(p.thumb), w, h, alt: str(p.alt, 250), caption: str(p.caption, 200) };
    });
    const section = sectionIds.has(g.section as string) ? (g.section as string) : sections[0].id;
    const service = SERVICES.includes(g.service as Service) ? (g.service as Service) : 'events';
    const cover = keys.has(g.cover as string) ? (g.cover as string) : photos[0]?.key ?? '';
    const now = new Date().toISOString();
    return {
      slug,
      title: str(g.title, 80) || 'Untitled gallery',
      kind: str(g.kind, 60),
      section,
      service,
      blurb: str(g.blurb, 400),
      visible: g.visible === true,
      cover,
      photos,
      createdAt: typeof g.createdAt === 'string' ? g.createdAt : now,
      updatedAt: typeof g.updatedAt === 'string' ? g.updatedAt : now,
    };
  });
  return { schema: 1, sections, galleries };
}

/** What the public site is built from. */
export function published(c: Content) {
  const galleries = c.galleries
    .filter((g) => g.visible && g.photos.length > 0)
    .map(({ slug, title, kind, section, service, blurb, cover, photos }) => ({
      slug,
      title,
      kind,
      section,
      service,
      blurb,
      cover,
      photos: photos.map(({ key, url, w, h, alt, caption }) => ({ key, url, w, h, alt, caption })),
    }));
  const used = new Set(galleries.map((g) => g.section));
  const sections = c.sections.filter((s) => used.has(s.id));
  const body = { sections, galleries };
  const hash = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
  return { hash, version: c.version, ...body };
}
