/* A hero photo is the largest thing on the first screen, so a page builds it
   once here and hands the result to the layout (for the preload hints) and to
   the hero (for the picture). Phones get the portrait cut from
   src/assets/crops (made by scripts/crops.mjs); wider screens get the frame. */

import { getImage } from 'astro:assets';
import { photo, type PhotoId } from '../data/photos';

export const PHONE = '(max-width: 47.99rem)';
export const WIDE = '(min-width: 48rem)';

export interface HeroImage {
  id: PhotoId;
  alt: string;
  caption: string;
  width: number;
  height: number;
  wide: { avif: string; webp: string };
  phone?: { avif: string; webp: string; width: number; height: number };
  fallback: string;
  preloads: { srcset: string; sizes: string; type: string; media?: string }[];
}

const WIDE_WIDTHS = [960, 1280, 1600, 1920, 2400];
const PHONE_WIDTHS = [480, 720, 960];

async function set(src: ImageMetadata, widths: number[], format: 'avif' | 'webp', quality: number) {
  const list = widths.filter((w) => w <= src.width);
  const out = await Promise.all(list.map(async (w) => `${(await getImage({ src, width: w, format, quality })).src} ${w}w`));
  return out.join(', ');
}

export async function heroImage(id: PhotoId): Promise<HeroImage> {
  const p = photo(id);
  const [wAvif, wWebp] = await Promise.all([set(p.src, WIDE_WIDTHS, 'avif', 46), set(p.src, WIDE_WIDTHS, 'webp', 62)]);
  let phone: HeroImage['phone'];
  if (p.phone) {
    const [mAvif, mWebp] = await Promise.all([set(p.phone, PHONE_WIDTHS, 'avif', 40), set(p.phone, PHONE_WIDTHS, 'webp', 56)]);
    phone = { avif: mAvif, webp: mWebp, width: p.phone.width, height: p.phone.height };
  }
  const fb = await getImage({ src: p.src, width: 1280, format: 'jpeg', quality: 72 });
  const preloads = phone
    ? [
        { srcset: phone.avif, sizes: '100vw', type: 'image/avif', media: PHONE },
        { srcset: wAvif, sizes: '100vw', type: 'image/avif', media: WIDE },
      ]
    : [{ srcset: wAvif, sizes: '100vw', type: 'image/avif' }];
  return {
    id,
    alt: p.alt,
    caption: p.caption,
    width: 1280,
    height: Math.round((1280 * p.src.height) / p.src.width),
    wide: { avif: wAvif, webp: wWebp },
    phone,
    fallback: fb.src,
    preloads,
  };
}
