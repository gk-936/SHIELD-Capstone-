import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Polyfill CustomEvent for Node.js < 19 environments (like v18.19.1)
if (typeof global !== 'undefined' && typeof CustomEvent === 'undefined') {
  (global as any).CustomEvent = class CustomEvent extends Event {
    constructor(event: string, params: any) {
      super(event, params);
      (this as any).detail = params?.detail;
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Force listening on all interfaces (Tailscale/Public)
    strictPort: true,
  }
})
