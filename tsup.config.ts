import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      'client/index': 'src/client/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    external: ['react', 'react-dom'],
    banner: {
      js: "'use client'",
    },
  },
  {
    entry: {
      'server/index': 'src/server/index.ts',
      'next/index': 'src/next/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    external: ['react', 'react-dom', 'next'],
  },
])
