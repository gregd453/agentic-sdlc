import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Validate VITE_DASHBOARD_PORT is set (required, no default)
const dashboardPortEnv = process.env.VITE_DASHBOARD_PORT;
if (!dashboardPortEnv) {
  console.error('❌ ERROR: VITE_DASHBOARD_PORT environment variable is not set');
  console.error('');
  console.error('Usage:');
  console.error('  export VITE_DASHBOARD_PORT=3050');
  console.error('  npm run dev');
  console.error('');
  console.error('Or in .env file:');
  console.error('  VITE_DASHBOARD_PORT=3050');
  console.error('');
  process.exit(1);
}

const port = parseInt(dashboardPortEnv, 10);
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`❌ ERROR: VITE_DASHBOARD_PORT must be a valid port number (1-65535), got: ${dashboardPortEnv}`);
  process.exit(1);
}

export default defineConfig({
  plugins: [react()],
  server: {
    port,
    host: process.env.VITE_HOST || '0.0.0.0'
  }
})
