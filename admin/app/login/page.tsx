import { redirect } from 'next/navigation';
import { isSignedIn } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<{ wrong?: string }> }) {
  if (await isSignedIn()) redirect('/');
  const { wrong } = await searchParams;
  return (
    <main className="login">
      <form className="login__card" method="post" action="/api/login">
        <img src="/badge.webp" width={102} height={80} alt="WVR Photography" />
        <h1>WVR Studio</h1>
        <p className="muted">Upload photos and manage the galleries on wvrphotography.com.</p>
        <label htmlFor="pp">Passphrase</label>
        <input id="pp" name="passphrase" type="password" autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} required autoFocus />
        {wrong && (
          <p className="login__error" role="alert">
            That passphrase did not match. Check the spelling and the dashes between words.
          </p>
        )}
        <button className="btn primary block" type="submit">
          Sign in
        </button>
        <p className="fine muted">You stay signed in on this device for four months.</p>
      </form>
    </main>
  );
}
