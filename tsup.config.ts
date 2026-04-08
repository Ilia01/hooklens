import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: true,
  external: ['node:sqlite'],
  banner: {
    js: '#!/usr/bin/env node',
  },
})
