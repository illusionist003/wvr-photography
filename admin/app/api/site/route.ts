/* Public: what the website is built from. Read by the site's GitHub workflow.
   ?hash=1 returns only the fingerprint, for the "did anything change" check. */
import { NextResponse } from 'next/server';
import { published, readContent } from '@/lib/content';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { content } = await readContent();
  if (!content) return NextResponse.json({ error: 'no content yet' }, { status: 404 });
  const pub = published(content);
  const onlyHash = new URL(req.url).searchParams.has('hash');
  return NextResponse.json(onlyHash ? { hash: pub.hash } : pub, {
    headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}
