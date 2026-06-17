import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Where InvenTree actually lives, resolved by the dev server (not the phone).
// Node can't resolve *.localhost, so we hit 127.0.0.1 and set the Host header
// below. Override both with INVENTREE_PROXY_TARGET / INVENTREE_HOST when
// InvenTree runs elsewhere (e.g. a Pi: INVENTREE_PROXY_TARGET=http://192.168.1.x).
const inventreeTarget = process.env.INVENTREE_PROXY_TARGET ?? 'http://127.0.0.1'
const inventreeHost = process.env.INVENTREE_HOST ?? 'inventree.localhost'

const proxyPaths = ['/api', '/web', '/static', '/media']

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    // Expose on the LAN so a phone on the same Wi-Fi can reach the dev server.
    host: true,
    // Allow tunnel hostnames (e.g. *.trycloudflare.com) to load the dev server.
    allowedHosts: true,
    // Same-origin proxy to InvenTree, so the app can call /api, /web, /static
    // without the phone needing to resolve inventree.localhost (and no CORS).
    proxy: Object.fromEntries(
      proxyPaths.map((path) => [
        path,
        {
          target: inventreeTarget,
          changeOrigin: true,
          // InvenTree vhosts on the Host header; force it since we dial 127.0.0.1.
          headers: { Host: inventreeHost },
        },
      ])
    ),
  },
})
