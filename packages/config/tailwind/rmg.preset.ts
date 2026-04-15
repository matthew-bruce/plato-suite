/**
 * Royal Mail Group Design System — Tailwind CSS Preset
 *
 * Maps every --rmg-* CSS custom property (defined in tokens/rmg.css) into
 * Tailwind utility classes. Load rmg.css in your entry stylesheet BEFORE
 * applying these classes so the variables are in scope.
 *
 * Usage in tailwind.config.ts:
 *   import rmgPreset from '@plato/config/tailwind/rmg.preset'
 *   export default { presets: [rmgPreset], ... }
 */

import type { Config } from 'tailwindcss'

const rmgPreset: Partial<Config> = {
  theme: {
    extend: {

      /* --------------------------------------------------------
         SCREENS — RM grid breakpoints
         375px  2-col,  30px margin, 30px gutter
         768px  12-col, 39px margin, 30px gutter
         1024px 12-col, 47px margin, 30px gutter
         1440px 12-col, 165px margin, 30px gutter
         -------------------------------------------------------- */
      screens: {
        sm:  '375px',
        md:  '768px',
        lg:  '1024px',
        xl:  '1440px',
        '2xl': '1536px',
      },

      /* --------------------------------------------------------
         COLOURS
         -------------------------------------------------------- */
      colors: {
        rmg: {
          /* Core brand */
          red:    'var(--rmg-color-red)',
          yellow: 'var(--rmg-color-yellow)',
          white:  'var(--rmg-color-white)',

          /* Primary accents */
          'warm-red':   'var(--rmg-color-warm-red)',
          'bright-red': 'var(--rmg-color-bright-red)',
          pink:         'var(--rmg-color-pink)',
          orange:       'var(--rmg-color-orange)',

          /* Secondary accents — neutrals */
          black:       'var(--rmg-color-black)',
          'dark-grey': 'var(--rmg-color-dark-grey)',
          'grey-1':    'var(--rmg-color-grey-1)',
          'grey-2':    'var(--rmg-color-grey-2)',
          'grey-3':    'var(--rmg-color-grey-3)',
          'grey-4':    'var(--rmg-color-grey-4)',
          'grey-300':  'var(--rmg-color-grey-300)',
          'brand-black': 'var(--rmg-color-brand-black)',

          /* Secondary accents — functional */
          blue:           'var(--rmg-color-blue)',
          green:          'var(--rmg-color-green)',
          'green-contrast': 'var(--rmg-color-green-contrast)',

          /* Tints */
          'tint-yellow': 'var(--rmg-color-tint-yellow)',
          'tint-orange': 'var(--rmg-color-tint-orange)',
          'tint-pink':   'var(--rmg-color-tint-pink)',
          'tint-green':  'var(--rmg-color-tint-green)',
          'tint-red':    'var(--rmg-color-tint-red)',

          /* Surfaces */
          'surface-white': 'var(--rmg-color-surface-white)',
          'surface-light': 'var(--rmg-color-surface-light)',

          /* Semantic text — light mode */
          text: {
            heading: 'var(--rmg-color-text-heading)',
            body:    'var(--rmg-color-text-body)',
            light:   'var(--rmg-color-text-light)',
            accent:  'var(--rmg-color-text-accent)',
          },

          /* Semantic text — dark mode */
          'text-dark': {
            heading: 'var(--rmg-color-text-dark-heading)',
            accent:  'var(--rmg-color-text-dark-accent)',
          },
        },
      },

      /* --------------------------------------------------------
         FONT FAMILIES
         -------------------------------------------------------- */
      fontFamily: {
        display: ['var(--rmg-font-display)'],
        body:    ['var(--rmg-font-body)'],
      },

      /* --------------------------------------------------------
         FONT SIZES + LINE HEIGHTS
         Font sizes are responsive via CSS custom properties —
         the variable values change at 768px and 1200px breakpoints
         (see tokens/rmg.css). Using these classes in markup gives
         you automatic responsive scaling with no extra Tailwind
         responsive prefixes needed for display/heading styles.
         -------------------------------------------------------- */
      fontSize: {
        /* Display — RM First Class */
        'd1': ['var(--rmg-text-d1)', { lineHeight: 'var(--rmg-leading-d1)', fontFamily: 'var(--rmg-font-display)' }],
        'd2': ['var(--rmg-text-d2)', { lineHeight: 'var(--rmg-leading-d2)', fontFamily: 'var(--rmg-font-display)' }],

        /* Headings — RM First Class */
        'h1': ['var(--rmg-text-h1)', { lineHeight: 'var(--rmg-leading-h1)', fontFamily: 'var(--rmg-font-display)' }],
        'h2': ['var(--rmg-text-h2)', { lineHeight: 'var(--rmg-leading-h2)', fontFamily: 'var(--rmg-font-display)' }],
        'h3': ['var(--rmg-text-h3)', { lineHeight: 'var(--rmg-leading-h3)', fontFamily: 'var(--rmg-font-display)' }],
        'h4': ['var(--rmg-text-h4)', { lineHeight: 'var(--rmg-leading-h4)', fontFamily: 'var(--rmg-font-display)' }],
        'h5': ['var(--rmg-text-h5)', { lineHeight: 'var(--rmg-leading-h5)', fontFamily: 'var(--rmg-font-display)' }],
        'h6': ['var(--rmg-text-h6)', { lineHeight: 'var(--rmg-leading-h6)', fontFamily: 'var(--rmg-font-display)' }],
        'h7': ['var(--rmg-text-h7)', { lineHeight: 'var(--rmg-leading-h7)', fontFamily: 'var(--rmg-font-display)' }],

        /* Body — PF DinText Std (fixed across breakpoints) */
        'b1': ['var(--rmg-text-b1)', { lineHeight: 'var(--rmg-leading-b1)' }],
        'b2': ['var(--rmg-text-b2)', { lineHeight: 'var(--rmg-leading-b2)' }],
        'b3': ['var(--rmg-text-b3)', { lineHeight: 'var(--rmg-leading-b3)' }],

        /* Caption — PF DinText Std */
        'c1': ['var(--rmg-text-c1)', { lineHeight: 'var(--rmg-leading-c1)' }],
        'c2': ['var(--rmg-text-c2)', { lineHeight: 'var(--rmg-leading-c2)' }],
      },

      /* --------------------------------------------------------
         LINE HEIGHTS (standalone, for overrides)
         -------------------------------------------------------- */
      lineHeight: {
        'rmg-d1': 'var(--rmg-leading-d1)',
        'rmg-d2': 'var(--rmg-leading-d2)',
        'rmg-h1': 'var(--rmg-leading-h1)',
        'rmg-h2': 'var(--rmg-leading-h2)',
        'rmg-h3': 'var(--rmg-leading-h3)',
        'rmg-h4': 'var(--rmg-leading-h4)',
        'rmg-h5': 'var(--rmg-leading-h5)',
        'rmg-h6': 'var(--rmg-leading-h6)',
        'rmg-h7': 'var(--rmg-leading-h7)',
        'rmg-b1': 'var(--rmg-leading-b1)',
        'rmg-b2': 'var(--rmg-leading-b2)',
        'rmg-b3': 'var(--rmg-leading-b3)',
        'rmg-c1': 'var(--rmg-leading-c1)',
        'rmg-c2': 'var(--rmg-leading-c2)',
      },

      /* --------------------------------------------------------
         SPACING — maps spacing-01…13 to Tailwind spacing scale
         These are ADDITIVE — they coexist with Tailwind's default
         spacing scale and are accessible via e.g. p-rmg-04, gap-rmg-06.
         -------------------------------------------------------- */
      spacing: {
        'rmg-01':  'var(--rmg-spacing-01)',   /*   4px */
        'rmg-02':  'var(--rmg-spacing-02)',   /*   8px */
        'rmg-03':  'var(--rmg-spacing-03)',   /*  12px */
        'rmg-04':  'var(--rmg-spacing-04)',   /*  16px */
        'rmg-05':  'var(--rmg-spacing-05)',   /*  20px */
        'rmg-06':  'var(--rmg-spacing-06)',   /*  24px */
        'rmg-07':  'var(--rmg-spacing-07)',   /*  32px */
        'rmg-08':  'var(--rmg-spacing-08)',   /*  40px */
        'rmg-09':  'var(--rmg-spacing-09)',   /*  48px */
        'rmg-10':  'var(--rmg-spacing-10)',   /*  64px */
        'rmg-11':  'var(--rmg-spacing-11)',   /*  80px */
        'rmg-12':  'var(--rmg-spacing-12)',   /*  96px */
        'rmg-13':  'var(--rmg-spacing-13)',   /* 128px */
      },

      /* --------------------------------------------------------
         BOX SHADOWS / ELEVATION
         Source: Effects page
         -------------------------------------------------------- */
      boxShadow: {
        'rmg-card':     'var(--rmg-shadow-card)',
        'rmg-megamenu': 'var(--rmg-shadow-megamenu)',
        'rmg-header':   'var(--rmg-shadow-header)',
      },

      borderRadius: {
        'rmg-xs':  'var(--rmg-radius-xs)',
        'rmg-s':   'var(--rmg-radius-s)',
        'rmg-m':   'var(--rmg-radius-m)',
        'rmg-l':   'var(--rmg-radius-l)',
        'rmg-xl':  'var(--rmg-radius-xl)',
      },
    },
  },
}

export default rmgPreset
