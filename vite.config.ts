import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages deployment base path
  base: process.env.VITE_CAPACITOR_BUILD === 'true' ? './' : '/Accident-Guard/',
  server: {
    port: 5173,
    host: true
  },
  build: {
    // Production source maps for crash debugging in Play Store
    sourcemap: true,
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: {
          // React core (changes rarely)
          'vendor-react': ['react', 'react-dom'],
          // Map engines (loaded on demand, large)
          'vendor-maps': ['leaflet', '@googlemaps/js-api-loader'],
          // Icon library
          'vendor-icons': ['lucide-react']
        }
      }
    }
  }
});
