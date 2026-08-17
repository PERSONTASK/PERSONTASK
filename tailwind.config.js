/** @type {import('tailwindcss').Config} */
// PERSONTASK design tokens. Brand gradient: blue #3B82F6 → indigo #6366F1 → violet #8B5CF6.
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Grátis plan is locked to Roboto; Premium may swap via CSS var --pt-font.
        sans: ['var(--pt-font, "Roboto")', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          blue: '#3B82F6',
          indigo: '#6366F1',
          violet: '#8B5CF6',
          DEFAULT: '#6366F1',
        },
        // Surface tokens are driven by CSS variables (see src/styles/index.css)
        surface: {
          base: 'rgb(var(--surface-base) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          overlay: 'rgb(var(--surface-overlay) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
          faint: 'rgb(var(--ink-faint) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06)',
        lift: '0 8px 40px rgba(0,0,0,.16)',
      },
      borderRadius: {
        xl: '14px',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(.96) translateY(-8px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-in': { from: { transform: 'translateX(30px)' }, to: { transform: 'translateX(0)' } },
      },
      animation: {
        'fade-in': 'fade-in .18s ease',
        'scale-in': 'scale-in .18s ease',
        'slide-in': 'slide-in .22s cubic-bezier(.25,.46,.45,.94)',
      },
    },
  },
  plugins: [],
};
