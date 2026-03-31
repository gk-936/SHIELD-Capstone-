import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Polyfill CustomEvent for Node.js < 19 environments (like v18.19.1)
if (typeof global !== 'undefined' && typeof CustomEvent === 'undefined') {
  (global as any).CustomEvent = class CustomEvent extends Event {
    constructor(event: string, params: any) {
      super(event, params);
      (this as any).detail = params ? (params as any).detail : undefined;
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    // Setting allowedHosts to true disables the host-header check
    // Perfectly safe for a private Tailscale network
    allowedHosts: true 
  }
})
