/** @type {import('tailwindcss').Config} */
// One token set, generated per client. Every neutral, status colour, stage colour and radius resolves to a CSS variable
// declared in src/config/tokens.css (written by scaffold_os.py from os.yaml `brand:` + `design:`), so `gray-500`,
// `text-tertiary`, `surface-border` and `--ink-3` are the same ink, not four near-misses. The `graphite` tone is the
// steel-grey set (500 is the lightest grey that may carry text; 400 is disabled controls and marks only); `pastel` is a
// brand-hued set. The brand and primary scales below are the one place hex values live, because index.css needs theme().
const NEUTRAL = {
    50: 'var(--surface-2)', 100: 'var(--surface-2)', 200: 'var(--line)', 300: 'var(--line-strong)', 400: 'var(--ink-4)',
    500: 'var(--ink-3)', 600: 'var(--ink-2)', 700: 'var(--ink-2)', 800: 'var(--ink)', 900: 'var(--ink)',
};
// Semantic status: `text` on `soft` is an AA pair; `DEFAULT` is the mark (dot, bar, ring).
// Red means overdue / lost / destructive — nothing else, whatever the brand colour is.
const STATUS = {
    ok:   { DEFAULT: 'var(--ok)',   text: 'var(--ok-text)',   soft: 'var(--ok-soft)' },
    warn: { DEFAULT: 'var(--warn)', text: 'var(--warn-text)', soft: 'var(--warn-soft)' },
    bad:  { DEFAULT: 'var(--bad)',  text: 'var(--bad-text)',  soft: 'var(--bad-soft)' },
    info: { DEFAULT: 'var(--info)', text: 'var(--info-text)', soft: 'var(--info-soft)' },
};
// Pipeline stage ramp: darkens as a lead advances (New → Negotiation); Won is success, Lost is a hollow grey ring.
const STAGE = [1, 2, 3, 4, 5, 6].map((i) => `var(--stage-${i})`);

module.exports = {
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            // IBM Plex, self-hosted (@fontsource): the same face on Windows and Mac, tabular figures for every number.
            fontFamily: {
                // Faces are CSS variables: IBM Plex on the login page, the client's face (design.font) inside the app. Both self-hosted.
                sans: ['var(--font-sans)'],
                display: ['var(--font-display)'],
                mono: ['var(--font-mono)'],
            },
            colors: {
                rail: { DEFAULT: 'var(--nav-bg)', soft: 'var(--nav-hover)', hover: 'var(--nav-hover)', line: 'var(--nav-line)' },
                nav: { DEFAULT: 'var(--nav-bg)', ink: 'var(--nav-ink)', 2: 'var(--nav-ink-2)', line: 'var(--nav-line)', hover: 'var(--nav-hover)', active: 'var(--nav-active-bg)', 'active-ink': 'var(--nav-active-ink)' },
                brand: {
                    50: '#EBF6F3',
                    100: '#D8EDE7',
                    200: '#B1DBCF',
                    300: '#80C5B2',
                    400: '#46AA8E',
                    500: '#0B8F6A',
                    600: '#0A7E5D',
                    700: '#076148',
                    800: '#06503B',
                    900: '#054030',
                },
                // `primary` is what interactive things use. The scaffolder fills it with the brand scale, or with the
                // ink scale when the brand is a red (a red primary button, a red overdue chip and a red progress bar
                // cannot be told apart). `brand` stays the identity: logo and the active-nav marker.
                primary: {
                    50: '#F5F4F0',
                    100: '#ECEBE6',
                    200: '#E0DDD6',
                    300: '#B5AFA4',
                    400: '#6C757D',
                    500: '#141413',
                    600: '#2A2620',
                    700: '#141413',
                    800: '#141413',
                    900: '#141413',
                },
                stage: Object.fromEntries(STAGE.map((c, i) => [i + 1, c])),
                gray: NEUTRAL,
                slate: NEUTRAL,
                ink: { DEFAULT: NEUTRAL[900], 2: NEUTRAL[600], 3: NEUTRAL[500], 4: NEUTRAL[400] },
                surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)', secondary: 'var(--surface-2)', tertiary: 'var(--bg)', border: 'var(--line)' },
                text: { primary: NEUTRAL[900], secondary: NEUTRAL[600], tertiary: NEUTRAL[500], muted: NEUTRAL[400] },
                ok: STATUS.ok, warn: STATUS.warn, bad: STATUS.bad, info: STATUS.info,
                // legacy names kept so older custom sections keep compiling; same values as above
                intent: {
                    success: { bg: STATUS.ok.soft, text: STATUS.ok.text, border: STATUS.ok.DEFAULT },
                    warning: { bg: STATUS.warn.soft, text: STATUS.warn.text, border: STATUS.warn.DEFAULT },
                    danger:  { bg: STATUS.bad.soft, text: STATUS.bad.text, border: STATUS.bad.DEFAULT },
                    info:    { bg: STATUS.info.soft, text: STATUS.info.text, border: STATUS.info.DEFAULT },
                    neutral: { bg: NEUTRAL[100], text: NEUTRAL[600], border: NEUTRAL[300] },
                },
            },
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
                '112': '28rem',
                '128': '32rem',
            },
            // The radius scale, generated per client (design.radius: crisp 6/8/10/12 · soft 6/10/14/18 · …): xs chips · sm controls, buttons,
            // nav rows · md cards · lg overlays. rounded-lg = control, rounded-xl = card, rounded-2xl = overlay. No pills.
            borderRadius: {
                'DEFAULT': 'var(--radius-xs)',
                'xs': 'var(--radius-xs)',
                'sm': 'var(--radius-sm)',
                'md': 'var(--radius)',
                'lg': 'var(--radius-sm)',
                'xl': 'var(--radius)',
                '2xl': 'var(--radius-lg)',
                '3xl': 'var(--radius-lg)',
            },
            // A resting surface is a 1px line. Shadow is reserved for what floats: drawer, modal, popover.
            boxShadow: {
                'xs': 'none',
                'sm': 'none',
                'md': '0 2px 6px rgba(21, 24, 28, 0.06)',
                'lg': '0 12px 32px -12px rgba(21, 24, 28, 0.22), 0 2px 6px rgba(21, 24, 28, 0.06)',
                'card': 'none',
                'card-hover': 'none',
                'overlay': '0 12px 32px -12px rgba(21, 24, 28, 0.22), 0 2px 6px rgba(21, 24, 28, 0.06)',
            },
            animation: {
                'fade-in': 'fadeIn 0.28s ease-out',
                'slide-up': 'slideUp 0.28s ease-out',
                'slide-down': 'slideDown 0.28s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
                'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
                slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                slideDown: { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                scaleIn: { '0%': { opacity: '0', transform: 'scale(0.98)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
                pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
            },
            transitionTimingFunction: {
                'smooth': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
            },
        },
    },
    // Page.jsx builds `lg:grid-cols-N` for `row` blocks at runtime; safelist them so Tailwind emits them.
    safelist: ['lg:grid-cols-1', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4', 'lg:grid-cols-5', 'lg:grid-cols-6', 'grid-cols-2', 'sm:grid-cols-3', 'lg:col-span-1', 'lg:col-span-2', 'lg:col-span-3', 'lg:col-span-4', 'lg:col-span-5', 'lg:col-span-6'],
    plugins: [],
}
