/* The galleries, as Matthew manages them in WVR Studio (the admin app at
   wvr-admin.vercel.app). scripts/sync-gallery.mjs saves the published ones to
   src/content/gallery.json and their photos to src/assets/gallery/ before
   every build; nothing here is edited by hand any more.

   Addresses stay /portfolio-collections/<slug>/, the same as the Wix site, so
   old links keep working. Every string here was typed by Matthew, so pages
   render it as plain text, and scripts/postbuild.mjs leaves it out of the
   house-style checks. */
import type { ImageMetadata } from 'astro';
import data from '../content/gallery.json';

export type Group = string;
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
  group: Group;
  blurb: string;
  cover: GalleryPhoto;
  photos: GalleryPhoto[];
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
  section: string;
  service: ServiceId;
  blurb: string;
  cover: string;
  photos: RawPhoto[];
}

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
    group: g.section,
    blurb: g.blurb,
    cover: photos.find((p) => p.key === g.cover) ?? photos[0],
    photos,
    service: g.service,
  };
});

export const GROUPS: { id: Group; title: string; intro: string }[] = (data.sections as { id: string; title: string; intro: string }[]).filter((s) =>
  COLLECTIONS.some((c) => c.group === s.id),
);

export const collectionPath = (c: Collection) => `/portfolio-collections/${c.slug}/`;
export const collection = (slug: string) => COLLECTIONS.find((c) => c.slug === slug);
/** The gallery a photo lives in, by its key (the original site photos kept their names). */
export const galleryOf = (key: string) => COLLECTIONS.find((c) => c.photos.some((p) => p.key === key));

/** Every piece of text Matthew typed, for the house-style checks to skip. */
export const USER_TEXT = [
  ...(data.sections as { title: string; intro: string }[]).flatMap((s) => [s.title, s.intro]),
  ...COLLECTIONS.flatMap((c) => [c.title, c.kind, c.blurb, ...c.photos.flatMap((p) => [p.caption, p.alt])]),
].filter(Boolean);
