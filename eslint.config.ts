import { defineConfig } from 'eslint/config';
import css from '@eslint/css';
import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const cssRecommended = css.configs.recommended;
const reactRecommendedTs = eslintReact.configs['recommended-typescript'];
const reactRecommendedPlugins = pickRecord(reactRecommendedTs, 'plugins');
const reactRecommendedSettings = pickRecord(reactRecommendedTs, 'settings');
const reactRecommendedRules = pickRecord(reactRecommendedTs, 'rules');
const typeCheckedConfigs = [
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked
]
  .filter((config) => config && typeof config === 'object')
  .map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}']
  }));

export default defineConfig([
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    ...js.configs.recommended
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  ...typeCheckedConfigs,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        chrome: 'readonly'
      }
    },
    plugins: {
      ...reactRecommendedPlugins,
      prettier: prettierPlugin
    },
    settings: {
      ...reactRecommendedSettings
    },
    rules: {
      ...reactRecommendedRules,
      'prettier/prettier': 'warn'
    }
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        vi: 'readonly'
      }
    }
  },
  {
    files: ['vite.config.ts', 'eslint.config.js', 'eslint.config.ts'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      'prettier/prettier': 'warn'
    }
  },
  prettierConfig,
  {
    files: ['**/*.{css,module.css}'],
    language: 'css/css',
    ...cssRecommended,
    rules: {
      ...(cssRecommended.rules ?? {}),
      'css/use-baseline': 'warn'
    }
  }
]);

function pickRecord(
  source: unknown,
  key: 'plugins' | 'settings' | 'rules'
): Record<string, unknown> {
  if (!isRecord(source)) {
    return {};
  }

  const value = source[key];
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
