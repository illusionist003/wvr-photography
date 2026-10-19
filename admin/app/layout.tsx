import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({ src: './fonts/InterTight.woff2', variable: '--font', weight: '100 900', display: 'swap' });

export const metadata: Metadata = {
  title: 'WVR Studio',
  description: 'Upload and manage galleries for wvrphotography.com',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'WVR Studio', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0a0d0e',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
