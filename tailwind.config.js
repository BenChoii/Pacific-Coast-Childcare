/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Geist for UI/body, Instrument Serif for editorial display headings
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Primary ocean blue — the brand "ink" (#0E74C1)
        brand: {
          50: '#EEF6FC',
          100: '#D5EAF8',
          200: '#AED5F0',
          300: '#7CBBE6',
          400: '#469CD8',
          500: '#2E8FD6', // ink-soft
          600: '#0E74C1', // ink (primary)
          700: '#0C5E9D',
          800: '#0E4E80',
          900: '#0F4068',
        },
        // Baby-blue accent (--accent-2 #BFD8E6)
        sky: {
          100: '#EAF2F7',
          200: '#D7E7F0',
          300: '#BFD8E6',
          400: '#9CC0D6',
          500: '#79A8C6',
          600: '#5C8DAE',
        },
        // Soft pink accents (--accent #F2C6CC / --accent-3 #F8E1E4)
        blush: {
          100: '#FBEEF0',
          200: '#F8E1E4',
          300: '#F2C6CC',
          400: '#E5A3AD',
          500: '#D4818D',
          600: '#BE6470',
        },
        // ----- Legacy tokens remapped to the refined pastel palette -----
        // warm terracotta-pink (was "coral")
        coral: {
          400: '#E89B8E',
          500: '#DD7E6E',
          600: '#C9604F',
        },
        // soft honey/gold (was "sunshine")
        sunshine: {
          400: '#ECCB80',
          500: '#DBB35A',
        },
        // soft periwinkle/indigo for chart variety (was "grape")
        grape: {
          400: '#8FA3DA',
          500: '#6E84C8',
          600: '#5167B0',
        },
        // muted sage green (was "mint")
        mint: {
          400: '#9CCBB0',
          500: '#6FAE8C',
        },
        // Neutrals / surfaces from the site
        cream: '#FAFAF8',
        tint: '#F4F8FB',
        ivory2: '#F4F4F2',
        line: '#E6E6E4',
        ink: { DEFAULT: '#0E74C1', soft: '#2E8FD6' },
      },
      boxShadow: {
        playful: '0 18px 50px -24px rgba(14, 116, 193, 0.35)',
        card: '0 10px 34px -18px rgba(14, 78, 128, 0.18)',
      },
      borderRadius: {
        '4xl': '1.75rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float1: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-16px)' },
        },
        float2: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(14px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'pop-in': 'pop-in 0.35s ease-out both',
        float: 'float1 9s ease-in-out infinite',
        float2: 'float2 11s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
}
