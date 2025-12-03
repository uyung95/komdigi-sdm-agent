import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // base: './' ensures assets are loaded relatively, 
  // which is safer for GitHub Pages subdirectories
  base: './', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});