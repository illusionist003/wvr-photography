/* Direct uploads from the browser to the Blob store. This route only hands
   out a short-lived token, and only to a signed-in session, only for
   photos/<key>.jpg or photos/<key>-t.jpg, JPEG, under 25 MB. */
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';

const NAME = /^photos\/[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/;

export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  const signedIn = sessionFromRequest(req);
  try {
    const out = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!signedIn) throw new Error('signed out');
        if (!NAME.test(pathname)) throw new Error('bad file name');
        return {
          allowedContentTypes: ['image/jpeg'],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
