import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      // The entry point for our library
      entry: resolve(__dirname, 'src/index.js'),
      // The global variable name when used in a <script> tag (UMD build)
      name: 'DelaunayVoronoi',
      // The filenames for the different formats
      fileName: (format) => `voronoi-3d-js.${format}.js`,
    },
    rollupOptions: {
      // Bundle Tympanum to avoid CJS/ESM compatibility issues
      // external: ['@derschmale/tympanum'],
    },
  },
}); 