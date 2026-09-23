import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { parseProviders, readLlomaConfig } from './config.js'
import { classifyExecution, optimizeProviderOrder } from './jev.js'
import { buildProvider } from './providers.js'
import { runProviderChain } from './router.js'

const HELP = `fm-co — token-aware multi-provider coding CLI

USAGE
  fm-co [options] <prompt...>

OPTIONS
  --providers LIST   Provider chain, comma separated (default: codex,claude,grok,lloma,fm)
  --provider NAME    Use exactly one provider
  --jev              Enable Jev routing (default)
  --no-jev           Disable Jev routing
  --dry-run          Print the routing decision without executing a provider
  --timeout MS       Per-provider timeout; 0 means no timeout (default: 0)
  -h, --help         Show help
  -v, --version      Show version

PROVIDERS
  codex   OpenAI Codex CLI: codex exec <prompt>
  claude  Anthropic Claude Code: claude -p <prompt>
  grok    xAI Grok Build: grok -p <prompt>
  lloma   LLOMA OpenAI-compatible local model endpoint
  fm      Custom command configured with FM_CO_FM_COMMAND

JEV
  Set FM_CO_JEV_URL to LocalJev (for example http://gpu-host:8080).
  Jev only decides local_text vs agentic_code. It never edits files or generates the final answer.
`

function parseArgs(args) {
  let providersRaw = process.env.FM_CO_PROVIDERS || ''
  let single = ''
  let jev = process.env.FM_CO_JEV !== '0'
  let dryRun = false
  let timeoutMs = Number(process.env.FM_CO_TIMEOUT_MS || 0)
  const prompt = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') return { help: true }
    if (arg === '--version' || arg === '-v') return { version: true }
    if (arg === '--jev') { jev = true; continue }
    if (arg === '--no-jev') { jev = false; continue }
    if (arg === '--dry-run') { dryRun = true; continue }
    if (arg === '--providers') { providersRaw = args[++i] ?? ''; continue }
    if (arg.startsWith('--providers=')) { providersRaw = arg.slice('--providers='.length); continue }
    if (arg === '--provider') { single = args[++i] ?? ''; continue }
    if (arg.startsWith('--provider=')) { single = arg.slice('--provider='.length); continue }
    if (arg === '--timeout') { timeoutMs = Number(args[++i] ?? NaN); continue }
    if (arg.startsWith('--timeout=')) { timeoutMs = Number(arg.slice('--timeout='.length)); continue }
    if (arg === '--') { prompt.push(...args.slice(i + 1)); break }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
    prompt.push(arg)
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new Error('--timeout must be a non-negative number')
  const providers = single ? parseProviders(single) : parseProviders(providersRaw)
  return { providers, jev, dryRun, timeoutMs, prompt: prompt.join(' ').trim() }
}

async function packageVersion() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const pkg = JSON.parse(await readFile(path.join(here, '..', 'package.json'), 'utf8'))
  return pkg.version
}

export async function main(args, deps = {}) {
  const stdout = deps.stdout || process.stdout
  const stderr = deps.stderr || process.stderr
  let parsed
  try {
    parsed = parseArgs(args)
  } catch (error) {
    stderr.write(`fm-co: ${error.message}\n`)
    return 2
  }
  if (parsed.help) { stdout.write(HELP); return 0 }
  if (parsed.version) { stdout.write(`${await packageVersion()}\n`); return 0 }
  if (!parsed.prompt) { stderr.write('fm-co: prompt is required\n'); return 2 }

  const env = deps.env || process.env
  const cwd = deps.cwd || process.cwd()
  const lloma = deps.lloma || await readLlomaConfig(env)
  let providers = parsed.providers
  let decision = null

  if (parsed.jev) {
    decision = await (deps.classifyExecution || classifyExecution)(parsed.prompt, {
      baseUrl: env.FM_CO_JEV_URL,
      endpoint: lloma.endpoint,
      token: lloma.token,
      fetchImpl: deps.fetchImpl || fetch,
      timeoutMs: Number(env.FM_CO_JEV_TIMEOUT_MS || 1800),
    })
    providers = optimizeProviderOrder(providers, decision, Boolean(lloma.token))
  }

  if (parsed.dryRun) {
    stdout.write(JSON.stringify({ decision, providers }, null, 2) + '\n')
    return 0
  }

  const result = await (deps.runProviderChain || runProviderChain)(providers, {
    cwd,
    fingerprint: deps.fingerprint,
    buildProvider: (name) => (deps.buildProvider || buildProvider)(name, parsed.prompt, {
      env,
      cwd,
      timeoutMs: parsed.timeoutMs,
      runner: deps.runner,
      fetchImpl: deps.fetchImpl || fetch,
      lloma,
    }),
    onEvent(event) {
      if (event.type === 'fallback') stderr.write(`[fm-co] quota reached: ${event.from} -> ${event.to}\n`)
      if (event.type === 'provider_failure' && event.kind === 'unavailable') stderr.write(`[fm-co] unavailable: ${event.provider}; trying next provider\n`)
    },
  })

  if (result.ok) {
    stdout.write(result.output || '')
    if (result.output && !result.output.endsWith('\n')) stdout.write('\n')
    return 0
  }
  stderr.write(`[fm-co] ${result.provider || 'router'} failed (${result.kind}): ${result.detail || 'unknown error'}\n`)
  return 1
}

export { parseArgs, HELP }
