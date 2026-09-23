import test from 'node:test'
import assert from 'node:assert/strict'
import { parseJsonStringArray, parseProviders } from '../src/config.js'

test('parseProviders de-duplicates and validates', () => {
  assert.deepEqual(parseProviders('codex,claude,codex'), ['codex', 'claude'])
  assert.throws(() => parseProviders('codex,nope'), /Unsupported provider/)
})

test('JSON args must be string arrays', () => {
  assert.deepEqual(parseJsonStringArray('["--foo","bar"]', 'X'), ['--foo', 'bar'])
  assert.throws(() => parseJsonStringArray('{"x":1}', 'X'), /JSON string array/)
})
