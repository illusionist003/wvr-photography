/* The editor's document: GET the latest, PUT a new version (with the ETag it
   was based on, so a stale phone cannot overwrite the desktop's changes). */
import { NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { clean, Conflict, published, readContent, writeContent, type Content } from '@/lib/content';
import { dispatchBuild } from '@/lib/publish';

export const dynamic = 'force-dynamic';

const deny = () => NextResponse.json({ error: 'signed out' }, { status: 401 });

export async function GET(req: Request) {
  if (!sessionFromRequest(req)) return deny();
  const { content, etag } = await readContent();
  return NextResponse.json({ content, etag }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: Request) {
  if (!sessionFromRequest(req)) return deny();
  const body = (await req.json().catch(() => null)) as { content?: unknown; etag?: string | null } | null;
  if (!body?.content) return NextResponse.json({ error: 'missing document' }, { status: 400 });
  let doc;
  try {
    doc = clean(body.content);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const { content: current } = await readContent();
  const next: Content = { ...doc, version: (current?.version ?? 0) + 1, updatedAt: new Date().toISOString() };
  try {
    const { etag } = await writeContent(next, body.etag ?? null);
    const before = current ? published(current).hash : '';
    const after = published(next).hash;
    if (before !== after) dispatchBuild().catch(() => {});
    return NextResponse.json({ content: next, etag, publishedHash: after }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof Conflict) return NextResponse.json({ error: 'conflict' }, { status: 409 });
    throw e;
  }
}
