// ispeak-board/vite.config.js

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  // IMPORTANT: The base must match the subfolder on your live site
  base: '/board/',
  build: {
    rollupOptions: {
      // This tells Vite to treat each HTML file as a separate page
      input: {
        main: resolve(__dirname, 'index.html'),      // Your React App
        login: resolve(__dirname, 'login.html'),
        admin: resolve(__dirname, 'admin.html'),
        student: resolve(__dirname, 'student.html'),
        study: resolve(__dirname, 'study.html'),
      },
    },
  },
})
