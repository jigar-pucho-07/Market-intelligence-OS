'use client';
// LanguageSwitch — v4.9 contract C9. The UI language is switchable at runtime: choosing one re-renders every kernel label through
// t() (src/i18n.jsx) with no reload, and the choice is kept on the device under localStorage `pucho-lang`.
// Rendered from HeaderTools.jsx, and only when the OS declares more than one UI language (config/i18n.js LANGUAGES: English +
// every language that has a `translations:` block in os.yaml).
import { useEffect, useRef, useState } from 'react';
import { Select, Tooltip } from 'antd';
import { Languages } from 'lucide-react';
import { LANGUAGES } from '../config/i18n';
import { OS } from '../config/os.config';
import { useLang, useT, LANGUAGE_NAMES, readStoredLang } from '../i18n';
import { selectProps } from '../config/popup';

export const LANG_KEY = 'pucho-lang';

/** Keep the language across visits: apply what `pucho-lang` holds on first paint, then write every change back. */
export function useLangPersist() {
  const { lang, setLang } = useLang(); const [ready, setReady] = useState(false);
  useEffect(() => {
    const v = readStoredLang(); if (v && v !== lang) setLang(v);   // `pucho-lang`, else an older `<slug>_lang` (migrated by the write below)
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on arrival
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(LANG_KEY, lang);
      // `pucho-lang` is the one store (src/i18n.jsx uses the same key). An `<slug>_lang` written by an older build was read above and is dropped here.
      localStorage.removeItem(`${OS.slug}_lang`);
    } catch { /* private mode */ }
    document.documentElement.lang = lang;
  }, [lang, ready]);
}

export default function LanguageSwitch() {
  const { lang, setLang } = useLang(); const t = useT();
  const ref = useRef(null); const [duplicate, setDuplicate] = useState(false);
  useLangPersist();
  // One switch per header. A shell that still renders the older switch itself (src/i18n.jsx) would show two: this one then steps aside and
  // lends its test id to the one already on screen, so there is exactly one `[data-testid=lang-switch]` either way.
  useEffect(() => {
    const all = document.querySelectorAll('[data-os-language]');
    if (all.length > 1 && all[0] !== ref.current) { all[0].setAttribute('data-testid', 'lang-switch'); setDuplicate(true); }
  });
  if (LANGUAGES.length < 2 || duplicate) return null;
  return (
    <span ref={ref} className="inline-flex items-center gap-1 ux-lang" data-os-language data-testid="lang-switch">
      <Tooltip title={t('Language')}><Languages className="w-4 h-4 text-ink-3" aria-hidden /></Tooltip>
      <Select {...selectProps} size="small" variant="borderless" value={lang} onChange={setLang} popupMatchSelectWidth={false} className="!min-h-0" aria-label={t('Language')}
        options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] ?? l }))} />
    </span>
  );
}
