import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { spawn } from 'child_process'
import fs from 'fs'
import net from 'net'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_PORT = 8000

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
}

// `npm run dev` used to start only the frontend. Nothing started the FastAPI
// backend after a restart, so every API call failed with ERR_CONNECTION_REFUSED
// ("Unable to load conversation history.") even though the data was safe in
// Supabase. Dev server only; reuses a backend already listening on :8000;
// opt out with SATQUERY_SKIP_BACKEND=1.
function satqueryBackend() {
  return {
    name: 'satquery-backend',
    apply: 'serve',
    async configureServer(server) {
      if (process.env.SATQUERY_SKIP_BACKEND === '1') return
      const log = server.config.logger
      const running = globalThis.__satqueryBackend
      if (running && running.exitCode === null) return // survives Vite config restarts
      if (await isPortOpen(BACKEND_PORT)) {
        log.info(`[satquery] backend already listening on :${BACKEND_PORT}; not starting another`)
        return
      }
      const backendDir = path.resolve(__dirname, 'backend')
      const python = path.join(backendDir, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
      // A fresh clone has neither the venv nor backend/.env (both gitignored);
      // say so loudly, with the fix, instead of a line that scrolls past.
      if (!fs.existsSync(python)) {
        log.warn([
          '',
          '[satquery] ============================================================',
          '[satquery] Backend NOT started: backend/.venv does not exist yet.',
          '[satquery] Chat history, uploads and profile will fail until it runs.',
          '[satquery] First-time setup:  npm run setup   (then restart npm run dev)',
          '[satquery] ============================================================',
          '',
        ].join('\n'))
        return
      }
      if (!fs.existsSync(path.join(backendDir, '.env'))) {
        log.warn([
          '',
          '[satquery] ============================================================',
          '[satquery] backend/.env is missing: the backend will start but cannot',
          '[satquery] reach Supabase, so chat history will not load.',
          '[satquery] Copy backend/.env.example to backend/.env and fill in',
          '[satquery] SUPABASE_URL and SUPABASE_SECRET_KEY (see README.md).',
          '[satquery] ============================================================',
          '',
        ].join('\n'))
      }
      // No --reload: detached on Windows the reloader keeps serving stale code
      // (see CLAUDE.md). Restart `npm run dev` after backend edits.
      const child = spawn(
        python,
        ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)],
        { cwd: backendDir, stdio: 'inherit' },
      )
      globalThis.__satqueryBackend = child
      log.info(`[satquery] started backend (pid ${child.pid}) on http://127.0.0.1:${BACKEND_PORT}`)
      child.on('exit', (code) => {
        if (code) log.error(`[satquery] backend exited with code ${code}`)
      })
      const stop = () => { if (child.exitCode === null) child.kill() }
      process.once('exit', stop)
      for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
        process.once(signal, () => { stop(); process.exit() })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    satqueryBackend(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
