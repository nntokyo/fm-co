const JEV_MAX_CHARS = 4096

function timeoutSignal(ms) {
  return AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined
}

function decisionFromSystemOne(payload) {
  const answer = payload?.answers?.execution
  const choice = answer?.choice
  const confidence = Number(answer?.confidence ?? 0)
  if (!['local_text', 'agentic_code'].includes(choice)) return null
  return { choice, confidence: Number.isFinite(confidence) ? confidence : 0, source: 'localjev' }
}

export async function classifyWithLocalJev(prompt, {
  baseUrl,
  fetchImpl = fetch,
  timeoutMs = 1800,
} = {}) {
  if (!baseUrl) return null
  const url = `${baseUrl.replace(/\/$/, '')}/v1/systemone`
  const state = prompt.slice(0, JEV_MAX_CHARS)
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'jev-latest',
        state,
        questions: {
          execution: {
            type: 'choice',
            instructions: 'Classify whether this task can be answered as text without repository inspection, file edits, commands, tests, external tools, or side effects.',
            criteria: {
              local_text: 'Text-only answer, explanation, rewrite, summary, or simple reasoning. No repository inspection, file changes, commands, tests, tool calls, or external side effects are required.',
              agentic_code: 'Requires repository inspection, coding, file changes, commands, tests, debugging, tool calls, deployment, or any external side effect.',
            },
          },
        },
      }),
      signal: timeoutSignal(timeoutMs),
    })
    if (!res.ok) return null
    return decisionFromSystemOne(await res.json())
  } catch {
    return null
  }
}

function parseBinaryChoice(text) {
  const normalized = text.trim().toLowerCase()
  if (/\blocal_text\b/.test(normalized)) return { choice: 'local_text', confidence: 0.7, source: 'lloma-jwenv' }
  if (/\bagentic_code\b/.test(normalized)) return { choice: 'agentic_code', confidence: 0.7, source: 'lloma-jwenv' }
  return null
}

export async function classifyWithLlomaJwenv(prompt, {
  endpoint,
  token,
  fetchImpl = fetch,
  timeoutMs = 3500,
} = {}) {
  if (!endpoint || !token) return null
  const url = `${endpoint.replace(/\/$/, '')}/chat/completions`
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'ollama/jwenv:1.7b',
        messages: [{
          role: 'user',
          content: `Classify into exactly one label: local_text or agentic_code.\nlocal_text = text-only; no repo inspection, file edits, commands, tests, tools, or side effects.\nagentic_code = any repo inspection, coding, file edits, commands, tests, tools, deployment, or side effects.\n\nTASK:\n${prompt.slice(0, JEV_MAX_CHARS)}\n\nLABEL:`,
        }],
        temperature: 0,
        max_tokens: 8,
        stream: false,
      }),
      signal: timeoutSignal(timeoutMs),
    })
    if (!res.ok) return null
    const json = await res.json()
    return parseBinaryChoice(json?.choices?.[0]?.message?.content || '')
  } catch {
    return null
  }
}

export async function classifyExecution(prompt, options = {}) {
  const local = await classifyWithLocalJev(prompt, options)
  if (local) return local
  return classifyWithLlomaJwenv(prompt, options)
}

export function optimizeProviderOrder(providers, decision, hasLlomaToken) {
  if (!decision || decision.choice !== 'local_text' || decision.confidence < 0.65 || !hasLlomaToken) {
    return [...providers]
  }
  if (!providers.includes('lloma')) return ['lloma', ...providers]
  return ['lloma', ...providers.filter((p) => p !== 'lloma')]
}
