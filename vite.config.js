import { defineConfig } from 'vite';

// Relative assets support both /repository-name/ Pages URLs and custom domains.
export default defineConfig({
  base: './',
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
});
