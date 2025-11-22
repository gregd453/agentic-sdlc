import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Validate VITE_DASHBOARD_PORT is set (required, no default)
const dashboardPortEnv = process.env.VITE_DASHBOARD_PORT;
if (!dashboardPortEnv) {
  console.error('❌ ERROR: VITE_DASHBOARD_PORT environment variable is not set');
  console.error('');
  console.error('Usage:');
  console.error('  export VITE_DASHBOARD_PORT=3053');
  console.error('  npm run dev');
  console.error('');
  console.error('Or in .env file:');
  console.error('  VITE_DASHBOARD_PORT=3053');
  console.error('');
  process.exit(1);
}

const port = parseInt(dashboardPortEnv, 10);
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`❌ ERROR: VITE_DASHBOARD_PORT must be a valid port number (1-65535), got: ${dashboardPortEnv}`);
  process.exit(1);
}

// Validate VITE_API_URL includes /api/v1 suffix (critical for correct API calls)
const apiUrl = process.env.VITE_API_URL;
if (apiUrl && !apiUrl.includes('/api/v1')) {
  console.error('❌ ERROR: VITE_API_URL must include the /api/v1 prefix');
  console.error('');
  console.error(`  Current value: ${apiUrl}`);
  console.error(`  Correct value: ${apiUrl}/api/v1`);
  console.error('');
  console.error('This is required for API calls to work correctly.');
  console.error('Update your .env file to include /api/v1 in VITE_API_URL');
  console.error('');
  process.exit(1);
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port,
    host: process.env.VITE_HOST || '0.0.0.0'
  }
})
