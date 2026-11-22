import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── AUREVYN "NOIR ATELIER" palette (2026-11) ─────────────────────
        // One monochrome direction: obsidian canvas, porcelain type, a single
        // muted champagne metallic for hairlines and rare emphasis. No second
        // accent hue — restraint is the luxury signal.
        //
        // Obsidian         #08080A — page canvas
        // Lacquer          #0E0E11 — cards, raised surfaces
        // Porcelain        #F5F3EC — primary type
        // Smoke            #8E8E96 — secondary type (5.4:1 on Lacquer)
        // Champagne        #C6AD7A — metallic rule / micro-accent only
        //
        // The `brand` ramp is the LIGHT action/link ramp: every value is an
        // ivory step, because the surrounding canvas is near-black. Fills built
        // from it carry near-black type (see the `.on-light-fill` guard rules
        // at the end of globals.css).
        brand: {
          50:  '#121210',
          100: '#1A1A17',
          200: '#3A372C',
          300: '#C9BFA6',
          400: '#DBD1B8',
          500: '#E7DFCA',
          600: '#EFE8D5',
          700: '#F5F1E6',
          800: '#FAF8F1',
          900: '#FFFDF7',
          950: '#FFFFFF',
        },
        // ── Muted Champagne (warm metallic, used sparingly) ──
        accent: {
          50:  '#12110C',
          100: '#1B1810',
          200: '#2E2A1C',
          300: '#D9C7A2',
          400: '#C6AD7A',
          500: '#B79B63',
          600: '#A98B50',
          700: '#8E7440',
          800: '#6E5A32',
          900: '#4A3C21',
        },
        // ── Ink palette (porcelain ramp — text on the obsidian canvas) ──
        ink: {
          50:  '#17171A',
          100: '#202024',
          200: '#2E2E34',
          300: '#55555D',
          400: '#8E8E96',   // Smoke — secondary type (5.4:1 on Lacquer)
          500: '#A6A6AD',
          600: '#C2C1BE',
          700: '#D8D6CE',
          800: '#EAE7DE',
          900: '#F5F3EC',   // Porcelain — primary type
          950: '#FFFDF8',
        },
        // ── Obsidian surfaces ──
        cream: {
          50:  '#08080A',   // Obsidian — page canvas
          100: '#0E0E11',   // Lacquer — cards / raised
          200: '#1B1B20',   // hairline border / skeleton
          300: '#2A2A31',
          400: '#3C3C44',
          500: '#52525A',
        },
        // ── Brass alias (legacy class names → Muted Champagne) ──
        brass: {
          50:  '#12110C',
          100: '#1B1810',
          200: '#2E2A1C',
          300: '#D9C7A2',
          400: '#C6AD7A',
          500: '#B79B63',
          600: '#A98B50',
          700: '#8E7440',
        },
        // ── Sage (success / calm surfaces on dark) ──
        sage: {
          50:  '#0F1613',
          100: '#132019',
          200: '#1B2C22',
          300: '#2A4535',
          400: '#4E7A5F',
          500: '#6FA383',
          600: '#8FD3A9',
        },
        // ── Semantic tones, retuned for a near-black canvas. The 600/700
        //    steps are readable TYPE colours; solid fills use them with
        //    near-black type via the on-light-fill guard.
        success: { 50: '#0F1A14', 600: '#8FD3A9', 700: '#A9E5C1' },
        danger:  { 50: '#1D1113', 600: '#F0888F', 700: '#F7A3A8' },
        // Neutral ramp overrides for the state hues actually used by existing
        // panels: the 50/100 steps are tinted DARK (so a notice panel reads as
        // a soft wash on the obsidian canvas) and the 600+ steps are light
        // enough to stay legible AS TYPE on those tints.
        emerald: { 50: '#0F1A14', 100: '#132019', 200: '#1B2C22', 600: '#8FD3A9', 700: '#A9E5C1' },
        red:     { 50: '#1D1113', 100: '#2A1518', 200: '#3A1C20', 500: '#E9707A', 600: '#F0888F', 700: '#F7A3A8' },
        amber:   { 50: '#1A1409', 100: '#241C0D', 200: '#332815', 400: '#C6AD7A', 500: '#D9BE8A', 600: '#E0C894', 700: '#EBD6A9', 800: '#F2E3C2', 900: '#F8EEDB' },
        blue:    { 50: '#0D1420', 100: '#13202F', 500: '#7FA9DC', 600: '#8FB6E8', 700: '#A6C7F0', 800: '#C2D8F5', 900: '#D7E6FA' },
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif',
        ],
      },
      fontSize: {
        'display-xl': ['4.5rem', { lineHeight: '0.94', letterSpacing: '-0.042em', fontWeight: '600' }],
        'display-lg': ['3.25rem', { lineHeight: '0.98', letterSpacing: '-0.036em', fontWeight: '600' }],
        'display':    ['2.15rem', { lineHeight: '1.04', letterSpacing: '-0.03em', fontWeight: '600' }],
      },
      letterSpacing: {
        display: '-0.032em',
        eyebrow: '0.22em',
        tight:   '-0.02em',
        snug:    '-0.01em',
      },
      boxShadow: {
        hair:  'inset 0 0 0 1px rgba(245, 243, 236, 0.08)',
        soft:  '0 1px 2px rgba(0, 0, 0, 0.5), 0 8px 24px -10px rgba(0, 0, 0, 0.8)',
        lift:  '0 2px 10px rgba(0, 0, 0, 0.55), 0 28px 60px -24px rgba(0, 0, 0, 0.9)',
        glow:  '0 0 0 1px rgba(198, 173, 122, 0.25), 0 24px 70px -28px rgba(198, 173, 122, 0.35)',
        card:  '0 1px 2px rgba(0, 0, 0, 0.45), 0 12px 32px -16px rgba(0, 0, 0, 0.85)',
        focus: '0 0 0 3px rgba(231, 223, 202, 0.3)',
      },
      transitionDuration: {
        micro: '120ms',
        fast: '160ms',
        normal: '220ms',
        slow: '240ms',
      },
      transitionTimingFunction: {
        aurevyn: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          from: { transform: 'translateX(-100%)' },
          to:   { transform: 'translateX(100%)' },
        },
        marquee: {
          from: { transform: 'translate3d(0, 0, 0)' },
          to:   { transform: 'translate3d(-50%, 0, 0)' },
        },
        aurora: {
          '0%, 100%': { transform: 'translate3d(-2%, -1%, 0) scale(1)' },
          '50%':      { transform: 'translate3d(3%, 2%, 0) scale(1.12)' },
        },
        float: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%':      { transform: 'translate3d(0, -10px, 0)' },
        },
        'pulse-ring': {
          '0%':   { transform: 'scale(0.85)', opacity: '0.9' },
          '100%': { transform: 'scale(2.1)', opacity: '0' },
        },
        'sheen-pan': {
          from: { backgroundPosition: '200% 0' },
          to:   { backgroundPosition: '-100% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
        shimmer: 'shimmer 1.6s linear infinite',
        marquee: 'marquee 42s linear infinite',
        aurora: 'aurora 22s ease-in-out infinite',
        float: 'float 9s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.6s cubic-bezier(0.16, 1, 0.3, 1) infinite',
        'sheen-pan': 'sheen-pan 3.2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
