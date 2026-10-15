// src/app/layout.tsx — the root: fonts (all self-hosted), the generated tokens, the kernel CSS, antd's style registry and
// the client providers. The signed-in person is read once here from the session cookie and handed to the client tree.
// v4.9: theme. <html data-theme data-tone> is rendered from the `pucho-theme` cookie (so antd's server style matches), and an inline
// script in <head> re-resolves it from localStorage / prefers-color-scheme BEFORE first paint — a dark user never sees a light frame.
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { AntdRegistry } from '@ant-design/nextjs-registry';
// IBM Plex for the Pucho login page, from node_modules (no remote request). Geist (inside the app) is in index.css.
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@/config/tokens.css';   // generated token values first, so index.css only references them
import '@/index.css';
import '@/design.css';
import '@/ux.css';      // v4.9 kernel UX (inline errors, 404/error pages, tooltips)
import Providers from '@/components/Providers';
import { currentUser } from '@/lib/auth';
import { OS, BRAND } from '@/config/os.config';
import { DESIGN } from '@/config/design';
import { darkStyleText } from '@/config/theme';

export const metadata: Metadata = {
  title: OS.name,
  description: OS.tagline,
  manifest: '/manifest.webmanifest',
  icons: { icon: '/brand/icon.svg', apple: '/brand/icon-180.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: OS.name },
};
export const viewport: Viewport = { themeColor: BRAND.color, width: 'device-width', initialScale: 1, colorScheme: 'light dark' };
export const dynamic = 'force-dynamic';   // every page depends on the session cookie

// Runs synchronously while <head> is parsed. Mode = localStorage `pucho-theme` (light | dark | system), else the cookie, else system.
const THEME_SCRIPT = `(function(){try{var d=document.documentElement,m=null;try{m=localStorage.getItem('pucho-theme')}catch(e){}
if(!m){var c=document.cookie.match(/(?:^|; )pucho-theme=(light|dark|system)/);m=c?c[1]:null}
if(m!=='light'&&m!=='dark')m='system';
var r=m==='system'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m;
d.setAttribute('data-theme',r);d.setAttribute('data-theme-mode',m);
document.cookie='pucho-theme-r='+r+';path=/;max-age=31536000;samesite=lax'}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  const jar = await cookies();
  const rawMode = jar.get('pucho-theme')?.value;
  const mode = rawMode === 'light' || rawMode === 'dark' ? rawMode : 'system';
  const theme = mode === 'system' ? (jar.get('pucho-theme-r')?.value === 'dark' ? 'dark' : 'light') : mode;
  return (
    <html lang="en" data-theme={theme} data-theme-mode={mode} data-tone={DESIGN.tone || 'pucho'} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* the dark values that need arithmetic (lifted primary, brand-hued pastel neutrals…) as plain hex — config/theme.js darkStyleText() */}
        <style id="pucho-dark-tone" dangerouslySetInnerHTML={{ __html: darkStyleText() }} />
      </head>
      <body>
        <AntdRegistry>
          <Providers user={user} theme={{ mode, theme }}>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
