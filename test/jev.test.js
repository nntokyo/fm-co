import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyWithLocalJev, optimizeProviderOrder } from '../src/jev.js'

test('LocalJev System One response is parsed', async () => {
  const result = await classifyWithLocalJev('explain this', {
    baseUrl: 'http://jev.test',
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return { answers: { execution: { choice: 'local_text', confidence: 0.92 } } }
      },
    }),
  })
  assert.deepEqual(result, { choice: 'local_text', confidence: 0.92, source: 'localjev' })
})

test('local_text prepends LLOMA only with sufficient confidence and token', () => {
  assert.deepEqual(
    optimizeProviderOrder(['codex', 'claude', 'lloma'], { choice: 'local_text', confidence: 0.9 }, true),
    ['lloma', 'codex', 'claude'],
  )
  assert.deepEqual(
    optimizeProviderOrder(['codex', 'claude'], { choice: 'local_text', confidence: 0.4 }, true),
    ['codex', 'claude'],
  )
})
