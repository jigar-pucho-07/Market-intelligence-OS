// i18n — one function, t(string), and a switcher. English is the source language (the os.yaml text); other languages
// come from the generated STRINGS map. The choice is per device (localStorage) and applies without a reload.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import { Languages } from 'lucide-react';
import { LANGUAGES, STRINGS } from './config/i18n';
import { OS } from './config/os.config';

export const LANGUAGE_NAMES = { en: 'English', hi: 'हिन्दी', gu: 'ગુજરાતી', mr: 'मराठी', ta: 'தமிழ்', te: 'తెలుగు', kn: 'ಕನ್ನಡ', bn: 'বাংলা', ml: 'മലയാളം', pa: 'ਪੰਜਾਬੀ', or: 'ଓଡ଼ିଆ' };
const KEY = 'pucho-lang';                              // one store, shared with components/LanguageSwitch.jsx
const LEGACY_KEY = `${OS.slug}_lang`;                  // the key older builds wrote; read once to migrate, then dropped
/** The language this device chose: `pucho-lang`, else a migrated `<slug>_lang`; null when none (or localStorage is unavailable). Client-only — call it from an effect. */
export function readStoredLang() {
  try { for (const k of [KEY, LEGACY_KEY]) { const v = localStorage.getItem(k); if (v && LANGUAGES.includes(v)) return v; } } catch { /* private mode */ }
  return null;
}
const Ctx = createContext({ lang: 'en', setLang: () => {}, t: (s) => s });

export function LangProvider({ children }) {
  // The first client render must equal the server's (the default language) or React reports a hydration mismatch (#418): the stored choice is applied just after mount.
  const [lang, setLangState] = useState(LANGUAGES[0] ?? 'en');
  useEffect(() => { const v = readStoredLang(); if (v) { setLangState(v); document.documentElement.lang = v; } }, []);
  const value = useMemo(() => ({
    lang,
    setLang: (l) => { setLangState(l); try { localStorage.setItem(KEY, l); } catch {} document.documentElement.lang = l; },
    t: (s) => (s === null || s === undefined ? s : (lang === 'en' ? String(s) : (STRINGS[lang]?.[String(s)] ?? String(s)))),
  }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useT() { return useContext(Ctx).t; }
export function useLang() { return useContext(Ctx); }

/** The language switcher for the header; renders nothing when the OS declares one language. */
export function LanguageSwitch() {
  const { lang, setLang } = useLang();
  if (LANGUAGES.length < 2) return null;
  return (
    <span className="inline-flex items-center gap-1" data-os-language>
      <Languages className="w-4 h-4 text-ink-3" />
      <Select size="small" variant="borderless" value={lang} onChange={setLang} popupMatchSelectWidth={false} className="!min-h-0"
        options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] ?? l }))} aria-label="Language" />
    </span>
  );
}
