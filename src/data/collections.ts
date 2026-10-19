/* The albums and galleries, as Matthew manages them in WVR Studio (the admin
   app at wvr-admin.vercel.app). Four layers: an album holds galleries, a
   gallery holds photos and sub galleries, a sub gallery holds photos. scripts/sync-gallery.mjs saves the published ones to
   src/content/gallery.json and their photos to src/assets/gallery/ before
   every build; nothing here is edited by hand any more.

   Galleries keep /portfolio-collections/<slug>/, the same as the Wix site, so
   old links keep working (sub galleries too, their addresses are unique);
   albums live at /portfolio/<album>/. Every string
   here was typed by Matthew, so pages render it as plain text, and
   scripts/postbuild.mjs leaves it out of the house-style checks. */
import type { ImageMetadata } from 'astro';
import data from '../content/gallery.json';

export type ServiceId = 'events' | 'products' | 'portraits';

export interface GalleryPhoto {
  key: string;
  w: number;
  h: number;
  alt: string;
  caption: string;
  src: ImageMetadata;
}

export interface Collection {
  slug: string;
  title: string;
  /** Short type label shown on cards. */
  kind: string;
  /** The album's slug. */
  album: string;
  /** The gallery this sub gallery sits inside; empty for a gallery directly in its album. */
  parent: string;
  blurb: string;
  /** When the shoot was, YYYY-MM-DD; empty when not given. */
  date: string;
  location: string;
  cover: GalleryPhoto;
  /** Its own photos; a gallery with sub galleries can have none. */
  photos: GalleryPhoto[];
  /** Its sub galleries, in order. */
  subs: Collection[];
  /** Its photos and its sub galleries' photos. */
  photoCount: number;
  service: ServiceId;
}

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/gallery/*.jpg', { eager: true });
const KIND: Record<ServiceId, string> = { events: 'Events', products: 'Product photography', portraits: 'Portraits' };

interface RawPhoto {
  key: string;
  w: number;
  h: number;
  alt: string;
  caption: string;
}
interface RawGallery {
  slug: string;
  title: string;
  kind: string;
  album: string;
  parent?: string;
  service: ServiceId;
  blurb: string;
  date?: string;
  location?: string;
  cover: string;
  photos: RawPhoto[];
}

/** Every gallery and sub gallery, each with its own page. */
export const COLLECTIONS: Collection[] = (data.galleries as RawGallery[]).map((g) => {
  const photos: GalleryPhoto[] = g.photos.map((p, i) => {
    const file = files[`../assets/gallery/${p.key}.jpg`];
    if (!file) throw new Error(`gallery photo missing on disk: ${p.key} (run node scripts/sync-gallery.mjs)`);
    return { key: p.key, w: p.w, h: p.h, caption: p.caption, alt: p.alt || p.caption || `${g.title}, photo ${i + 1} of ${g.photos.length}`, src: file.default };
  });
  return {
    slug: g.slug,
    title: g.title,
    kind: g.kind || KIND[g.service] || 'Gallery',
    album: g.album,
    parent: g.parent ?? '',
    blurb: g.blurb,
    date: g.date ?? '',
    location: g.location ?? '',
    cover: photos.find((p) => p.key === g.cover) ?? photos[0],
    photos,
    subs: [],
    photoCount: photos.length,
    service: g.service,
  };
});
for (const c of COLLECTIONS) {
  if (!c.parent) continue;
  const top = COLLECTIONS.find((t) => t.slug === c.parent);
  if (!top) throw new Error(`sub gallery ${c.slug} sits in a missing gallery ${c.parent}`);
  top.subs.push(c);
  top.photoCount += c.photos.length;
}
// a gallery holding only sub galleries shows the first one's cover
for (const c of COLLECTIONS) c.cover ??= c.subs[0]?.cover;

/** The galleries that sit directly in an album (no sub galleries). */
export const GALLERIES = COLLECTIONS.filter((c) => !c.parent);

export interface Album {
  slug: string;
  title: string;
  intro: string;
  cover: GalleryPhoto;
  galleries: Collection[];
  photoCount: number;
}

export const ALBUMS: Album[] = (data.albums as { slug: string; title: string; intro: string; cover: string }[])
  .map((a) => {
    const galleries = GALLERIES.filter((c) => c.album === a.slug);
    const photos = COLLECTIONS.filter((c) => c.album === a.slug).flatMap((g) => g.photos);
    return { slug: a.slug, title: a.title, intro: a.intro, galleries, photoCount: photos.length, cover: photos.find((p) => p.key === a.cover) ?? galleries[0]?.cover };
  })
  .filter((a) => a.galleries.length > 0);

export const albumPath = (a: Album) => `/portfolio/${a.slug}/`;
export const albumOf = (c: Collection) => ALBUMS.find((a) => a.slug === c.album)!;

export const collectionPath = (c: Collection) => `/portfolio-collections/${c.slug}/`;
export const collection = (slug: string) => COLLECTIONS.find((c) => c.slug === slug);
/** The gallery a sub gallery sits inside. */
export const parentOf = (c: Collection) => (c.parent ? collection(c.parent) : undefined);
/** The gallery a photo lives in, by its key (the original site photos kept their names). */
export const galleryOf = (key: string) => COLLECTIONS.find((c) => c.photos.some((p) => p.key === key));

/** Every piece of text Matthew typed, for the house-style checks to skip. */
export const USER_TEXT = [
  ...(data.albums as { title: string; intro: string }[]).flatMap((a) => [a.title, a.intro]),
  ...COLLECTIONS.flatMap((c) => [c.title, c.kind, c.blurb, c.location, ...c.photos.flatMap((p) => [p.caption, p.alt])]),
].filter(Boolean);
