// InstallPrompt — "Add to home screen" when the browser offers it (Chrome/Edge/Android). A small pill in the header;
// dismissed once per device. iOS has no prompt API: Safari users use Share → Add to Home Screen (the manifest and
// apple-touch-icon make that work).
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { OS } from '../config/os.config';

export default function InstallPrompt() {
  const [evt, setEvt] = useState(null);
  const key = `${OS.slug}_install_dismissed`;
  useEffect(() => {
    try { if (localStorage.getItem(key)) return; } catch {}
    const on = (e) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, [key]);
  if (!evt) return null;
  return (
    <button data-os-install onClick={async () => { evt.prompt(); const { outcome } = await evt.userChoice; if (outcome !== 'accepted') { try { localStorage.setItem(key, '1'); } catch {} } setEvt(null); }}
      className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100">
      <Download className="w-3.5 h-3.5" /> Install app
    </button>
  );
}
