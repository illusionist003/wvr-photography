/* Favicons, touch icons and the share image, made from his logo badge and one
   of his photos. Run `npm run icons` if either changes. */
import sharp from 'sharp';

const BADGE = new URL('../src/assets/brand/logo-badge.png', import.meta.url).pathname;
const PUB = new URL('../public/', import.meta.url).pathname;
const INK = { r: 10, g: 13, b: 14, alpha: 1 };

async function icon(size, file, pad = 0.1, bg = null) {
  const inner = Math.round(size * (1 - pad * 2));
  const badge = await sharp(BADGE).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: badge, gravity: 'center' }])
    .png()
    .toFile(PUB + file);
}

await icon(32, 'favicon-32.png', 0.02);
await icon(48, 'favicon-48.png', 0.02);
await icon(180, 'apple-touch-icon.png', 0.12, INK);
await icon(192, 'icon-192.png', 0.12, INK);
await icon(512, 'icon-512.png', 0.12, INK);

// favicon.ico: a single 48px PNG inside an ICO wrapper
const png = await sharp(PUB + 'favicon-48.png').toBuffer();
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(1, 4);
head.writeUInt8(48, 6);
head.writeUInt8(48, 7);
head.writeUInt8(0, 8);
head.writeUInt8(0, 9);
head.writeUInt16LE(1, 10);
head.writeUInt16LE(32, 12);
head.writeUInt32LE(png.length, 14);
head.writeUInt32LE(22, 18);
const { writeFileSync } = await import('node:fs');
writeFileSync(PUB + 'favicon.ico', Buffer.concat([head, png]));

// share image: his gala photo, darkened on the left, the badge on top
const photo = new URL('../src/assets/photos/event-gala-stage.jpg', import.meta.url).pathname;
const shade = Buffer.from(
  `<svg width="1200" height="630"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#0a0d0e" stop-opacity=".85"/><stop offset=".55" stop-color="#0a0d0e" stop-opacity=".25"/><stop offset="1" stop-color="#0a0d0e" stop-opacity="0"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`,
);
const badge = await sharp(BADGE).resize(300).toBuffer();
await sharp(photo)
  .resize(1200, 630, { fit: 'cover', position: 'centre' })
  .composite([{ input: shade }, { input: badge, left: 64, top: 160 }])
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(PUB + 'og-image.jpg');
console.log('icons and share image written');
