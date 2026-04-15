import type { Config } from 'tailwindcss'
import rmgPreset from '../../packages/config/tailwind/rmg.preset'

const config: Config = {
  presets: [rmgPreset as Config],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
}

export default config
