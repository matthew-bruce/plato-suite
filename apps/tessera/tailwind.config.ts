import type { Config } from 'tailwindcss'
import rmgPreset from '../../packages/config/tailwind/rmg.preset'

const config: Config = {
  presets: [rmgPreset as Config],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/components/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
}

export default config
