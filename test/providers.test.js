import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProvider } from '../src/providers.js'

test('FM prompt is sent via stdin, not shell arguments', async () => {
  let seen
  const provider = buildProvider('fm', 'hello $(touch nope)', {
    env: { FM_CO_FM_COMMAND: 'fake', FM_CO_FM_ARGS_JSON: '["--mode","chat"]' },
    runner: async (command, args, options) => {
      seen = { command, args, input: options.input }
      return { code: 0, signal: null, stdout: 'ok', stderr: '', spawnError: null }
    },
  })
  const result = await provider.run()
  assert.equal(result.ok, true)
  assert.deepEqual(seen, { command: 'fake', args: ['--mode', 'chat'], input: 'hello $(touch nope)' })
})

test('LLOMA auth failure does not become quota', async () => {
  const provider = buildProvider('lloma', 'hello', {
    lloma: { token: 'secret', endpoint: 'https://example.test/v1' },
    fetchImpl: async () => ({ ok: false, status: 401, async text() { return '{"error":{"message":"invalid token"}}' } }),
  })
  const result = await provider.run()
  assert.equal(result.kind, 'auth')
})
