import type { APIRoute } from 'astro';
import { SERVICES } from '../data/services';
import { ALBUMS, albumPath, COLLECTIONS, collectionPath } from '../data/collections';
import { BRAND } from '../data/site';

export const GET: APIRoute = () => {
  const paths = ['/', ...SERVICES.map((s) => s.path), '/portfolio/', ...ALBUMS.map(albumPath), ...COLLECTIONS.map(collectionPath), '/about/', '/contact/', '/privacy/'];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${BRAND.origin}${p}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
