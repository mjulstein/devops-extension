import { build as esbuildBuild } from 'esbuild';
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

// Bundles content-script and token-interceptor as self-contained IIFEs so they
// need no ES module support from Chrome and no "type": "module" in the manifest.
// All @/types imports are type-only and are silently dropped by esbuild.
function buildContentScriptPlugin() {
  return {
    name: 'build-content-script-iife',
    apply: 'build' as const,
    async closeBundle() {
      await esbuildBuild({
        entryPoints: [resolve('src/content-script.ts')],
        bundle: true,
        format: 'iife',
        outfile: resolve('dist/content-script.js'),
        target: ['chrome92'],
        tsconfig: resolve('tsconfig.json')
      });
      await esbuildBuild({
        entryPoints: [resolve('src/token-interceptor.ts')],
        bundle: true,
        format: 'iife',
        outfile: resolve('dist/token-interceptor.js'),
        target: ['chrome92'],
        tsconfig: resolve('tsconfig.json')
      });
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
    include: ['**/*.test.ts', '**/*.test.tsx'],
    setupFiles: ['src/test-setup.ts']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // content-script is intentionally excluded — built separately as IIFE by
      // buildContentScriptPlugin so it doesn't need ES module support in Chrome.
      input: {
        sidepanel: resolve('src/sidepanel.html'),
        'service-worker': resolve('src/service-worker.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: '[name][extname]'
      }
    }
  },
  plugins: [copyManifestPlugin(), buildContentScriptPlugin()]
});
