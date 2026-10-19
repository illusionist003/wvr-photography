/* The studio's content, three layers deep: albums hold galleries, galleries
   hold photos. One JSON file in the Blob store, written with an ETag
   check so two devices can never silently overwrite each other, plus a copy
   of every saved version under content/history/ for recovery.

   The public site only ever sees the published projection (published()):
   visible galleries with at least one photo, and the albums they sit in. */
import { createHash } from 'node:crypto';
import { BlobNotFoundError, BlobPreconditionFailedError, del, head, list, put } from '@vercel/blob';

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
  /** The album this gallery sits in. */
  album: string;
  service: Service;
  blurb: string;
  visible: boolean;
  cover: string;
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
}

/** The top layer: an album holds galleries, a gallery holds photos. */
export interface Album {
  slug: string;
  title: string;
  intro: string;
  /** A photo key from one of its galleries; empty means the first gallery's cover. */
  cover: string;
}

export interface Content {
  schema: 2;
  version: number;
  updatedAt: string;
  albums: Album[];
  galleries: Gallery[];
}

const PATH = 'content/manifest.json';
const HISTORY = 'content/history/';
const KEEP_HISTORY = 80;

/* The latest version, read so that a save can never land on top of something
   the editor did not see. head() asks the store for the current ETag; the
   file is then fetched with that ETag in the query so the CDN cannot answer
   from an older copy. (The SDK's useCache: false only works for private
   stores; this one is public so the photos can be served.) Right after a
   save the store can still hand back the previous copy for a moment, so the
   ETag returned is always the one of the copy actually read: if that copy is
   old, the next save is refused as a conflict instead of overwriting newer
   work. */
export async function readContent(): Promise<{ content: Content | null; etag: string | null }> {
  const strip = (t: string | null | undefined) => (t || '').replace(/^W\//, '');
  let last: { content: Content; etag: string | null } | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    let meta;
    try {
      meta = await head(PATH);
    } catch (e) {
      if (e instanceof BlobNotFoundError) return { content: null, etag: null };
      throw e;
    }
    const want = strip(meta.etag);
    const res = await fetch(`${meta.url}?v=${encodeURIComponent(want.replace(/"/g, ''))}-${attempt}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`content read failed: ${res.status}`);
    const content = upgrade(await res.json());
    const got = strip(res.headers.get('etag'));
    if (got && got === want) return { content, etag: got };
    last = { content, etag: got || null };
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  return last!;
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

export function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'album'
  );
}

/** Version 1 had flat "sections"; they become the first albums, nothing else changes. */
export function upgrade(raw: unknown): Content {
  const doc = raw as Record<string, unknown> & { schema?: number };
  if (doc.schema === 2) return doc as unknown as Content;
  const sections = (doc.sections as { id: string; title: string; intro: string }[]) ?? [];
  const map = new Map<string, string>();
  const taken = new Set<string>();
  const albums: Album[] = sections.map((sec) => {
    let slug = slugify(sec.title);
    for (let n = 2; taken.has(slug); n++) slug = `${slugify(sec.title)}-${n}`;
    taken.add(slug);
    map.set(sec.id, slug);
    return { slug, title: sec.title, intro: sec.intro ?? '', cover: '' };
  });
  const galleries = ((doc.galleries as (Gallery & { section?: string })[]) ?? []).map(({ section, ...g }) => ({ ...g, album: map.get(section ?? '') ?? albums[0]?.slug ?? '' }));
  return { schema: 2, version: Number(doc.version) || 0, updatedAt: String(doc.updatedAt ?? ''), albums, galleries };
}

/** Clean an incoming document from the editor. Throws on anything structural. */
export function clean(input: unknown): Omit<Content, 'version' | 'updatedAt'> {
  const doc = input as Partial<Content>;
  if (!doc || !Array.isArray(doc.albums) || !Array.isArray(doc.galleries)) throw new Error('bad document');
  if (doc.albums.length > 60 || doc.galleries.length > 400) throw new Error('too many items');

  const albumSlugs = new Set<string>();
  const rawAlbums = doc.albums.map((a) => {
    const slug = str(a?.slug, 60);
    if (!SLUG.test(slug) || albumSlugs.has(slug)) throw new Error(`bad or duplicate album address ${slug}`);
    albumSlugs.add(slug);
    return { slug, title: str(a.title, 60) || 'Untitled album', intro: str(a.intro, 300), cover: str(a.cover, 60) };
  });
  if (!rawAlbums.length) throw new Error('at least one album');

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
    const album = albumSlugs.has(g.album as string) ? (g.album as string) : rawAlbums[0].slug;
    const service = SERVICES.includes(g.service as Service) ? (g.service as Service) : 'events';
    const cover = keys.has(g.cover as string) ? (g.cover as string) : photos[0]?.key ?? '';
    const now = new Date().toISOString();
    return {
      slug,
      title: str(g.title, 80) || 'Untitled gallery',
      kind: str(g.kind, 60),
      album,
      service,
      blurb: str(g.blurb, 400),
      visible: g.visible === true,
      cover,
      photos,
      createdAt: typeof g.createdAt === 'string' ? g.createdAt : now,
      updatedAt: typeof g.updatedAt === 'string' ? g.updatedAt : now,
    };
  });

  // an album cover must be a photo that is in one of its galleries
  const albums: Album[] = rawAlbums.map((a) => {
    const inAlbum = galleries.filter((g) => g.album === a.slug).some((g) => g.photos.some((p) => p.key === a.cover));
    return { ...a, cover: inAlbum ? a.cover : '' };
  });
  return { schema: 2, albums, galleries };
}

/** What the public site is built from. */
export function published(c: Content) {
  const galleries = c.galleries
    .filter((g) => g.visible && g.photos.length > 0)
    .map(({ slug, title, kind, album, service, blurb, cover, photos }) => ({
      slug,
      title,
      kind,
      album,
      service,
      blurb,
      cover,
      photos: photos.map(({ key, url, w, h, alt, caption }) => ({ key, url, w, h, alt, caption })),
    }));
  const albums = c.albums
    .map((a) => {
      const inside = galleries.filter((g) => g.album === a.slug);
      if (!inside.length) return null;
      const cover = inside.some((g) => g.photos.some((p) => p.key === a.cover)) ? a.cover : inside[0].cover;
      return { slug: a.slug, title: a.title, intro: a.intro, cover };
    })
    .filter((a): a is Album => a !== null);
  const body = { albums, galleries };
  const hash = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
  return { hash, version: c.version, ...body };
}
