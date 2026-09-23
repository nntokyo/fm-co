import test from 'node:test'
import assert from 'node:assert/strict'
import { main } from '../src/cli.js'

function sink() {
  let value = ''
  return { write(x) { value += x }, get value() { return value } }
}

test('dry-run shows Jev-optimized order', async () => {
  const stdout = sink()
  const stderr = sink()
  const code = await main(['--dry-run', '--providers', 'codex,claude,lloma', 'explain this'], {
    stdout,
    stderr,
    env: { FM_CO_JEV_URL: 'http://jev' },
    lloma: { token: 'secret', endpoint: 'https://lloma.test/v1' },
    classifyExecution: async () => ({ choice: 'local_text', confidence: 0.9, source: 'localjev' }),
  })
  assert.equal(code, 0)
  const parsed = JSON.parse(stdout.value)
  assert.deepEqual(parsed.providers, ['lloma', 'codex', 'claude'])
})
