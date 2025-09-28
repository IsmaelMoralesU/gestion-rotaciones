import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  base: '/gestion-rotaciones/', 
  build: {
    target: 'es2015'
  }
});