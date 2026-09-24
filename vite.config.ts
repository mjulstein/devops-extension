import { copyFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';
import { defineConfig } from 'vitest/config';

function copyManifestPlugin() {
  return {
    name: 'copy-manifest',
    closeBundle() {
      copyFileSync(resolve('src/manifest.json'), resolve('dist/manifest.json'));

      // Vite keeps the source folder in the output path for an HTML entry; the
      // manifest refers to these pages at the root, so they are lifted back.
      for (const page of ['sidepanel.html', 'bookmarks.html']) {
        const nested = resolve(`dist/src/${page}`);
        if (existsSync(nested)) {
          renameSync(nested, resolve(`dist/${page}`));
        }
      }
      rmSync(resolve('dist/src'), { recursive: true, force: true });
    }
  };
}

// Bundles content-script and token-interceptor as self-contained IIFEs so they
// need no ES module support from Chrome and no "type": "module" in the manifest.
// A content script and a MAIN-world document_start script are both plain
// scripts, so they cannot be part of the main module build.
//
// Built through Vite in lib mode rather than a bundler of their own, so the
// project carries one bundler. `configFile: false` keeps this from re-entering
// the config that schedules it.
const IIFE_ENTRIES = ['content-script', 'token-interceptor'] as const;

function toGlobalName(entry: string): string {
  return entry.replace(/-./g, (match) => match[1].toUpperCase());
}

function buildContentScriptPlugin() {
  return {
    name: 'build-content-script-iife',
    apply: 'build' as const,
    async closeBundle() {
      for (const entry of IIFE_ENTRIES) {
        await build({
          configFile: false,
          logLevel: 'warn',
          resolve: {
            alias: {
              '@/types': resolve(import.meta.dirname, 'types/index.ts'),
              '@': resolve(import.meta.dirname, 'src')
            }
          },
          build: {
            outDir: 'dist',
            // The main build has already written its output here.
            emptyOutDir: false,
            target: 'chrome92',
            // Left readable: these run inside Azure DevOps's own page, where
            // being able to read them in DevTools is worth more than the bytes.
            minify: false,
            lib: {
              entry: resolve(import.meta.dirname, `src/${entry}.ts`),
              formats: ['iife'],
              name: toGlobalName(entry),
              fileName: () => `${entry}.js`
            }
          }
        });
      }
    }
  };
}

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@/types': resolve(import.meta.dirname, 'types/index.ts'),
      '@': resolve(import.meta.dirname, 'src')
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
        bookmarks: resolve('src/bookmarks.html'),
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
