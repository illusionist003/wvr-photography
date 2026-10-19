import { NextResponse } from 'next/server';
import { checkPassword, COOKIE, makeSession } from '@/lib/auth';

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const given = String(form?.get('passphrase') ?? '');
  // a slow answer either way, so guessing is pointless
  await new Promise((r) => setTimeout(r, 450));
  if (!given || !checkPassword(given)) {
    return NextResponse.redirect(new URL('/login?wrong=1', req.url), 303);
  }
  const s = makeSession();
  const res = NextResponse.redirect(new URL('/', req.url), 303);
  res.cookies.set(COOKIE, s.value, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: s.maxAge });
  return res;
}
