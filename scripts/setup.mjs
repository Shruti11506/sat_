#!/usr/bin/env node
// First-time backend setup for a fresh clone: `npm run setup`.
//
// Creates backend/.venv with Python 3.10+, installs backend/requirements.txt,
// and creates backend/.env from backend/.env.example if it doesn't exist
// (never overwrites one). After it, `npm run dev` starts frontend + backend.
// Node built-ins only, so it runs right after `npm install`.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backend = path.join(root, 'backend')
const venv = path.join(backend, '.venv')
const isWindows = process.platform === 'win32'
const venvPython = path.join(venv, isWindows ? 'Scripts/python.exe' : 'bin/python')
const MIN_PYTHON = [3, 10]

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...options })
  if (result.status !== 0) {
    console.error(`\n[setup] Failed: ${cmd} ${args.join(' ')}`)
    process.exit(result.status || 1)
  }
}

function pythonVersion(cmd, args) {
  const result = spawnSync(cmd, [...args, '-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8' })
  if (result.status !== 0 || !result.stdout) return null
  const [major, minor] = result.stdout.trim().split('.').map(Number)
  return { major, minor }
}

function findPython() {
  const candidates = isWindows
    ? [['py', ['-3.12']], ['py', ['-3.11']], ['py', ['-3.10']], ['py', ['-3']], ['python', []]]
    : [['python3.12', []], ['python3.11', []], ['python3.10', []], ['python3', []], ['python', []]]
  for (const [cmd, args] of candidates) {
    const version = pythonVersion(cmd, args)
    if (version && (version.major > MIN_PYTHON[0] || (version.major === MIN_PYTHON[0] && version.minor >= MIN_PYTHON[1]))) {
      return { cmd, args, label: `${version.major}.${version.minor}` }
    }
  }
  return null
}

console.log('[setup] SatQuery backend setup\n')

if (fs.existsSync(venvPython)) {
  console.log('[setup] backend/.venv already exists -- reusing it.')
} else {
  const python = findPython()
  if (!python) {
    console.error(`[setup] Python ${MIN_PYTHON.join('.')}+ was not found. Install it from https://www.python.org/downloads/ and run \`npm run setup\` again.`)
    process.exit(1)
  }
  console.log(`[setup] Creating backend/.venv with Python ${python.label} ...`)
  run(python.cmd, [...python.args, '-m', 'venv', venv])
}

console.log('[setup] Installing backend requirements (first time takes a minute or two) ...')
run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '-q', '-r', path.join(backend, 'requirements.txt')])

const envFile = path.join(backend, '.env')
let envNeedsValues = false
if (fs.existsSync(envFile)) {
  console.log('[setup] backend/.env already exists -- left unchanged.')
  envNeedsValues = /^(SUPABASE_URL|SUPABASE_SECRET_KEY)=(YOUR_|\s*$)/m.test(fs.readFileSync(envFile, 'utf8'))
} else {
  fs.copyFileSync(path.join(backend, '.env.example'), envFile)
  console.log('[setup] Created backend/.env from backend/.env.example.')
  envNeedsValues = true
}

console.log('\n[setup] Done.')
if (envNeedsValues) {
  console.log([
    '',
    '[setup] NEXT: open backend/.env and set, from the SAME Supabase project everyone uses',
    '[setup]       (Supabase dashboard -> Project Settings -> API, or ask the project owner):',
    '[setup]         SUPABASE_URL          the project URL',
    '[setup]         SUPABASE_SECRET_KEY   the secret / service_role key -- NOT the publishable/anon key',
    '[setup]       Never commit backend/.env; it is gitignored.',
  ].join('\n'))
}
console.log('\n[setup] Then run:  npm run dev   and open the URL it prints.')
