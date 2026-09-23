import { FailureKind, classifyFailure, isQuotaText } from './errors.js'
import { parseJsonStringArray } from './config.js'
import { runProcess } from './process.js'

function commandProvider(name, command, args, prompt, options = {}) {
  return {
    name,
    async run() {
      const result = await (options.runner || runProcess)(command, [...args, prompt], {
        cwd: options.cwd,
        timeoutMs: options.timeoutMs,
      })
      const kind = classifyFailure(result)
      if (result.code === 0) return { ok: true, output: result.stdout, stderr: result.stderr }
      return {
        ok: false,
        kind,
        detail: result.stderr || result.stdout || `${name} exited with code ${result.code}`,
      }
    },
  }
}

export function buildProvider(name, prompt, {
  env = process.env,
  cwd = process.cwd(),
  timeoutMs = 0,
  runner = runProcess,
  fetchImpl = fetch,
  lloma,
} = {}) {
  if (name === 'codex') {
    return commandProvider('codex', env.FM_CO_CODEX_COMMAND || 'codex', [
      'exec',
      ...parseJsonStringArray(env.FM_CO_CODEX_ARGS_JSON, 'FM_CO_CODEX_ARGS_JSON'),
    ], prompt, { cwd, timeoutMs, runner })
  }
  if (name === 'claude') {
    return commandProvider('claude', env.FM_CO_CLAUDE_COMMAND || 'claude', [
      ...parseJsonStringArray(env.FM_CO_CLAUDE_ARGS_JSON, 'FM_CO_CLAUDE_ARGS_JSON'),
      '-p',
    ], prompt, { cwd, timeoutMs, runner })
  }
  if (name === 'grok') {
    return commandProvider('grok', env.FM_CO_GROK_COMMAND || 'grok', [
      '--no-auto-update',
      ...parseJsonStringArray(env.FM_CO_GROK_ARGS_JSON, 'FM_CO_GROK_ARGS_JSON'),
      '--output-format', 'plain',
      '-p',
    ], prompt, { cwd, timeoutMs, runner })
  }
  if (name === 'fm') {
    const command = env.FM_CO_FM_COMMAND
    if (!command) {
      return { name: 'fm', async run() { return { ok: false, kind: FailureKind.UNAVAILABLE, detail: 'FM_CO_FM_COMMAND is not configured' } } }
    }
    const args = parseJsonStringArray(env.FM_CO_FM_ARGS_JSON, 'FM_CO_FM_ARGS_JSON')
    return {
      name: 'fm',
      async run() {
        const result = await runner(command, args, { cwd, timeoutMs, input: prompt })
        const kind = classifyFailure(result)
        if (result.code === 0) return { ok: true, output: result.stdout, stderr: result.stderr }
        return { ok: false, kind, detail: result.stderr || result.stdout || `fm exited with code ${result.code}` }
      },
    }
  }
  if (name === 'lloma') {
    return {
      name: 'lloma',
      async run() {
        if (!lloma?.token) return { ok: false, kind: FailureKind.UNAVAILABLE, detail: 'LLOMA token is not configured. Run `lloma login` or set LLOMA_API_KEY.' }
        const url = `${lloma.endpoint.replace(/\/$/, '')}/chat/completions`
        try {
          const res = await fetchImpl(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lloma.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: env.FM_CO_LLOMA_MODEL || 'ollama/qwen2.5-coder:14b',
              messages: [{ role: 'user', content: prompt }],
              stream: false,
            }),
            signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
          })
          const text = await res.text()
          if (!res.ok) {
            let message = text
            try {
              const json = JSON.parse(text)
              message = json?.error?.message || text
            } catch {}
            return {
              ok: false,
              kind: res.status === 401 || res.status === 403 ? FailureKind.AUTH : isQuotaText(message) ? FailureKind.QUOTA : FailureKind.UPSTREAM,
              detail: `LLOMA HTTP ${res.status}: ${message.slice(0, 1000)}`,
            }
          }
          const json = JSON.parse(text)
          return { ok: true, output: json?.choices?.[0]?.message?.content || '', stderr: '' }
        } catch (error) {
          if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return { ok: false, kind: FailureKind.TIMEOUT, detail: 'LLOMA request timed out' }
          return { ok: false, kind: FailureKind.NETWORK, detail: `LLOMA request failed: ${error?.message || error}` }
        }
      },
    }
  }
  throw new Error(`Unsupported provider: ${name}`)
}
