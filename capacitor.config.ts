import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.inkstock.app',
  appName: 'InkStock',
  webDir: 'dist',
  android: {
    // InvenTree is typically served over plain HTTP on the LAN/Pi, so allow
    // cleartext. The app calls InvenTree directly (no dev-server proxy in the
    // APK) via VITE_INVENTREE_API_BASE_URL.
    allowMixedContent: true,
  },
}

export default config
