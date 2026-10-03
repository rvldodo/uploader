import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    server: 'src/main/server.ts',
    worker: 'src/main/worker.ts',
    migrate: 'src/main/migrate.ts',
    'init-storage': 'src/main/init-storage.ts',
  },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  // The contracts package ships TypeScript source, so bundle it in.
  noExternal: ['@media-upload/contracts'],
})
