import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.VITE_DASHBOARD_PORT || '3050', 10),
    host: process.env.VITE_HOST || '0.0.0.0'
    // Removed proxy configuration - client code now makes direct calls to localhost:3051/api/v1
  }
})
