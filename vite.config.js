import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    // THE NUCLEAR OPTION: Allow all hosts to bypass security block on Tailscale
    allowedHosts: true,
    hmr: {
        host: 'homeserver.taila28f72.ts.net'
    }
  }
})
