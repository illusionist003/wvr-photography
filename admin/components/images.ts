/* Photos are prepared in the browser before they upload: turned upright,
   scaled to 2400px on the long edge (plenty for the site, a fraction of a
   camera original) and saved as JPEG, plus a 640px thumbnail for this app.
   A 24 megapixel file from the camera becomes about 1 MB, so a 60 photo
   album uploads fine over a phone connection. */

export const FULL = 2400;
export const THUMB = 640;

export interface Prepared {
  full: Blob;
  thumb: Blob;
  w: number;
  h: number;
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

function size(src: ImageBitmap | HTMLImageElement) {
  return 'naturalWidth' in src ? { w: src.naturalWidth, h: src.naturalHeight } : { w: src.width, h: src.height };
}

function canvasOf(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { c, ctx };
}

function toJpeg(c: HTMLCanvasElement, q: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('could not encode'))), 'image/jpeg', q));
}

export async function prepare(file: File): Promise<Prepared> {
  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await decode(file);
  } catch {
    throw new Error('This file could not be opened. Export it as a JPEG and try again.');
  }
  const { w: sw, h: sh } = size(src);
  if (!sw || !sh) throw new Error('This file could not be opened.');
  const k = Math.min(1, FULL / Math.max(sw, sh));
  const w = Math.round(sw * k);
  const h = Math.round(sh * k);

  // big downscales in one jump look soft, so halve first when the original is huge
  let stage: CanvasImageSource = src;
  let stw = sw;
  let sth = sh;
  while (stw / 2 >= w * 1.5) {
    const half = canvasOf(Math.round(stw / 2), Math.round(sth / 2));
    half.ctx.drawImage(stage, 0, 0, half.c.width, half.c.height);
    stage = half.c;
    stw = half.c.width;
    sth = half.c.height;
  }
  const full = canvasOf(w, h);
  full.ctx.drawImage(stage, 0, 0, w, h);
  if ('close' in src) src.close();

  const tk = Math.min(1, THUMB / Math.max(w, h));
  const thumb = canvasOf(Math.round(w * tk), Math.round(h * tk));
  thumb.ctx.drawImage(full.c, 0, 0, thumb.c.width, thumb.c.height);

  const [fullBlob, thumbBlob] = await Promise.all([toJpeg(full.c, 0.9), toJpeg(thumb.c, 0.8)]);
  full.c.width = full.c.height = 0;
  thumb.c.width = thumb.c.height = 0;
  return { full: fullBlob, thumb: thumbBlob, w, h };
}

export function newKey() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'gallery'
  );
}
