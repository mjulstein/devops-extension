import { copyFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

function copyManifestPlugin() {
  return {
    name: 'copy-manifest',
    closeBundle() {
      copyFileSync(resolve('src/manifest.json'), resolve('dist/manifest.json'));

      const nestedSidepanel = resolve('dist/src/sidepanel.html');
      const rootSidepanel = resolve('dist/sidepanel.html');

      if (existsSync(nestedSidepanel)) {
        renameSync(nestedSidepanel, rootSidepanel);
        rmSync(resolve('dist/src'), { recursive: true, force: true });
      }
    }
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@/types': resolve(__dirname, 'types/index.ts'),
      '@': resolve(__dirname, 'src')
    }
  },
  publicDir: false,
  test: {
    globals: true,
    include: ['**/*.test.ts', '**/*.test.tsx']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve('src/sidepanel.html'),
        'content-script': resolve('src/content-script.ts'),
        'service-worker': resolve('src/service-worker.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: '[name][extname]'
      }
    }
  },
  plugins: [copyManifestPlugin()]
});
