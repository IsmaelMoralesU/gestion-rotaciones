import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      pages: 'dist',
      assets: 'dist',
      fallback: 'index.html',
      precompress: false,
      strict: false
    }),
    paths: {
      base: process.env.NODE_ENV === 'production' ? '/gestion-rotaciones' : ''
    }
  }
};