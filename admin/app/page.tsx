import { redirect } from 'next/navigation';
import { isSignedIn } from '@/lib/auth';
import { SITE_URL } from '@/lib/publish';
import AdminApp from '@/components/AdminApp';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!(await isSignedIn())) redirect('/login');
  return <AdminApp site={SITE_URL} />;
}
