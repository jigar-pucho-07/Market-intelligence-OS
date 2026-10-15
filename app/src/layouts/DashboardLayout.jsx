// DashboardLayout — shell + header + page. The content column leaves exactly the shell's width on desktop:
// the sidebar shell is 240 / 68px, the rail shell is 64px plus its panel when one is open, so the layout
// measures the <aside> instead of assuming a number. Gutters follow design.density (--page-gutter).
import { useLocation } from '../lib/router';
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { DESIGN } from '../config/design';
import Header from '../components/Header';
import { PoweredBy } from '../components/BrandMark';

function useShellWidth() {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    let ro;
    const attach = () => {
      ro?.disconnect();
      const el = document.querySelector('aside[data-os-shell]:not([data-os-shell="mobile"])');
      if (!el || !mq.matches) { setW(0); return; }
      const read = () => setW(mq.matches ? el.getBoundingClientRect().width : 0);
      read(); ro = new ResizeObserver(read); ro.observe(el);
    };
    attach();
    const mo = new MutationObserver(attach); mo.observe(document.body, { childList: true, subtree: false });
    mq.addEventListener('change', attach);
    return () => { ro?.disconnect(); mo.disconnect(); mq.removeEventListener('change', attach); };
  }, []);
  return w;
}

export default function DashboardLayout({ children, wiring }) {
  const [expanded, setExpanded] = useState(true); const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation(); const mainRef = useRef(null);
  const shellW = useShellWidth();
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [pathname]);
  // The client's design direction (src/design.css) applies inside the app only; the login keeps the Pucho faces.
  // `os-app` switches the face from the Pucho login to the client's; `data-tone` lets index.css carry the tone's own component states (v4.8: pucho)
  useEffect(() => { const el = document.documentElement; el.classList.add('os-app'); el.dataset.tone = DESIGN.tone || 'pucho'; return () => { el.classList.remove('os-app'); }; }, []);
  return (
    <div className="flex h-screen app-canvas overflow-hidden font-sans text-text-primary">
      <Sidebar expanded={expanded} mobileOpen={mobileOpen} onToggle={() => setExpanded(!expanded)} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden relative transition-[margin-left] duration-300" style={{ marginLeft: shellW }} data-os-content>
        <Header onMenuClick={() => setMobileOpen(true)} wiring={wiring} />
        <main ref={mainRef} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="page-gutter pt-5 pb-20 w-full">{children}</div>   {/* pb-20: the fixed badge never sits on the last row */}
        </main>
      </div>
      <PoweredBy />
    </div>
  );
}
