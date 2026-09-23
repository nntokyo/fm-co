import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const DEFAULT_PROVIDERS = ['codex', 'claude', 'grok', 'lloma', 'fm']

export function parseJsonStringArray(raw, name) {
  if (!raw) return []
  let value
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error(`${name} must be a JSON string array`)
  }
  if (!Array.isArray(value) || value.some((x) => typeof x !== 'string')) {
    throw new Error(`${name} must be a JSON string array`)
  }
  return value
}

export function parseProviders(raw) {
  const value = raw?.trim() ? raw.split(',').map((x) => x.trim()).filter(Boolean) : [...DEFAULT_PROVIDERS]
  const allowed = new Set(['codex', 'claude', 'grok', 'lloma', 'fm'])
  for (const provider of value) {
    if (!allowed.has(provider)) throw new Error(`Unsupported provider: ${provider}`)
  }
  return [...new Set(value)]
}

export async function readLlomaConfig(env = process.env) {
  if (env.LLOMA_API_KEY) {
    return {
      token: env.LLOMA_API_KEY,
      endpoint: env.FM_CO_LLOMA_ENDPOINT || 'https://lloma.n-n.tokyo/api/openai/v1',
    }
  }

  const configPath = env.LLOMA_CONFIG_PATH || path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'lloma', 'config.toml')
  let text
  try {
    text = await fs.readFile(configPath, 'utf8')
  } catch {
    return {
      token: '',
      endpoint: env.FM_CO_LLOMA_ENDPOINT || 'https://lloma.n-n.tokyo/api/openai/v1',
    }
  }

  let section = ''
  let token = ''
  let endpoint = ''
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const sectionMatch = line.match(/^\[(.+)]$/)
    if (sectionMatch) {
      section = sectionMatch[1]
      continue
    }
    if (section !== 'default') continue
    const kv = line.match(/^([A-Za-z0-9_]+)\s*=\s*"(.*)"\s*$/)
    if (!kv) continue
    if (kv[1] === 'token') token = kv[2]
    if (kv[1] === 'endpoint') endpoint = kv[2]
  }

  return {
    token,
    endpoint: env.FM_CO_LLOMA_ENDPOINT || endpoint || 'https://lloma.n-n.tokyo/api/openai/v1',
  }
}
