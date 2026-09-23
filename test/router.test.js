import test from 'node:test'
import assert from 'node:assert/strict'
import { runProviderChain } from '../src/router.js'

test('quota falls through to next provider', async () => {
  const calls = []
  const result = await runProviderChain(['codex', 'claude'], {
    fingerprint: async () => 'same',
    buildProvider(name) {
      return {
        async run() {
          calls.push(name)
          if (name === 'codex') return { ok: false, kind: 'quota', detail: 'limit' }
          return { ok: true, output: 'done' }
        },
      }
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.provider, 'claude')
  assert.deepEqual(calls, ['codex', 'claude'])
})

test('unknown failure does not fall through', async () => {
  const calls = []
  const result = await runProviderChain(['codex', 'claude'], {
    fingerprint: async () => 'same',
    buildProvider(name) {
      return { async run() { calls.push(name); return { ok: false, kind: 'unknown', detail: 'boom' } } }
    },
  })
  assert.equal(result.ok, false)
  assert.deepEqual(calls, ['codex'])
})

test('workspace change blocks quota fallback', async () => {
  let fingerprintCalls = 0
  const calls = []
  const result = await runProviderChain(['codex', 'claude'], {
    fingerprint: async () => (++fingerprintCalls === 1 ? 'before' : 'after'),
    buildProvider(name) {
      return { async run() { calls.push(name); return { ok: false, kind: 'quota', detail: 'limit' } } }
    },
  })
  assert.equal(result.ok, false)
  assert.equal(result.workspaceChanged, true)
  assert.deepEqual(calls, ['codex'])
})

test('unavailable provider is skipped when another provider exists', async () => {
  const calls = []
  const result = await runProviderChain(['codex', 'grok'], {
    fingerprint: async () => 'same',
    buildProvider(name) {
      return {
        async run() {
          calls.push(name)
          return name === 'codex' ? { ok: false, kind: 'unavailable', detail: 'missing' } : { ok: true, output: 'grok ok' }
        },
      }
    },
  })
  assert.equal(result.ok, true)
  assert.deepEqual(calls, ['codex', 'grok'])
})
