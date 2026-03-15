import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Separate large libraries into their own chunks
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-docx': ['docx'],
          'vendor-mammoth': ['mammoth'],
        },
      },
    },
  },
  optimizeDeps: {
    // Exclude CDN-loaded packages from pre-bundling
    exclude: [],
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer used by FFmpeg.wasm
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
