import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Set base to './' so that assets are relative, allowing deployment to GitHub Pages sub-paths.
  base: './',
})
