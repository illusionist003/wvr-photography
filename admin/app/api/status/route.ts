/* Is the public site showing the latest published content yet? Compares the
   fingerprint of what is published here with the one the live site was built
   from (gallery-version.txt, written by the site build). */
import { NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { published, readContent } from '@/lib/content';
import { SITE_URL } from '@/lib/publish';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!sessionFromRequest(req)) return NextResponse.json({ error: 'signed out' }, { status: 401 });
  const { content } = await readContent();
  const want = content ? published(content).hash : '';
  let live = '';
  try {
    const r = await fetch(`${SITE_URL}/gallery-version.txt?t=${Date.now()}`, { cache: 'no-store' });
    if (r.ok) live = (await r.text()).trim();
  } catch {}
  return NextResponse.json({ live: live === want, liveHash: live, wantHash: want, site: SITE_URL }, { headers: { 'Cache-Control': 'no-store' } });
}
