import { execFileSync } from 'node:child_process';
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
      for (const page of [
        'sidepanel.html',
        'bookmarks.html',
        'palette.html',
        'settings.html'
      ]) {
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

/**
 * The commit this was built from, for the panel's own header.
 *
 * Reloading an unpacked extension is easy to believe you have done, and a
 * panel that looks the same either way gives no way to tell. A dirty tree is
 * marked, since a build from uncommitted work is not the commit it names.
 *
 * Not a secret: the repository is public and the sha is in its history. It
 * falls back to a dash outside a checkout, where a build still has to work.
 */
function buildStamp(): string {
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8'
    }).trim();
    const dirty =
      execFileSync('git', ['status', '--porcelain'], {
        encoding: 'utf8'
      }).trim() !== '';
    return dirty ? `${sha}+` : sha;
  } catch {
    return '-';
  }
}

/**
 * Puts the build stamp in every page's `<title>`.
 *
 * The title is where you look when you want to know what a page is, and it
 * costs nothing: the popped-out panel, the bookmark manager and the settings
 * window all wear it in their title bar, and devtools shows it for the ones
 * that have no bar of their own.
 */
function stampTitlePlugin(stamp: string) {
  return {
    name: 'stamp-title',
    transformIndexHtml(html: string) {
      return html.replace(
        /<title>([^<]*)<\/title>/,
        (_match, title: string) => `<title>${title} · ${stamp}</title>`
      );
    }
  };
}

export default defineConfig({
  define: {
    __BUILD_SHA__: JSON.stringify(buildStamp())
  },
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
        palette: resolve('src/palette.html'),
        settings: resolve('src/settings.html'),
        'service-worker': resolve('src/service-worker.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: '[name][extname]'
      }
    }
  },
  plugins: [
    stampTitlePlugin(buildStamp()),
    copyManifestPlugin(),
    buildContentScriptPlugin()
  ]
});
