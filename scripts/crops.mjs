/* Portrait cuts of the hero photos for phones. A phone shows the hero tall and
   narrow, so cropping a 3:2 frame on the fly would keep a thin slice of a huge
   file. Each cut here is made once from the source photo at a chosen
   horizontal focus, then Astro sizes it like any other photo.
   Run `npm run crops` after adding a hero or moving a focus. */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = new URL('../src/assets/photos/', import.meta.url).pathname;
const OUT = new URL('../src/assets/crops/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// photo id: horizontal focus from 0 (left edge) to 1 (right edge)
export const FOCUS = {
  'event-mastermind-keynote': 0.5,
  'sport-gym-sparring': 0.47,
  'portrait-couple-lake': 0.6,
  'product-coffee-bags': 0.47,
  'event-mud-truck-smoke': 0.7,
  'event-gala-stage': 0.5,
  'product-crystal-palm-stones': 0.5,
};

const RATIO = 0.6; // width / height of the phone cut

for (const [id, fx] of Object.entries(FOCUS)) {
  const img = sharp(`${SRC}${id}.jpg`);
  const { width, height } = await img.metadata();
  const w = Math.round(height * RATIO);
  const left = Math.max(0, Math.min(width - w, Math.round(width * fx - w / 2)));
  await img.extract({ left, top: 0, width: w, height }).jpeg({ quality: 88, mozjpeg: true }).toFile(`${OUT}${id}-m.jpg`);
  console.log(`${id}-m.jpg ${w}x${height}`);
}
