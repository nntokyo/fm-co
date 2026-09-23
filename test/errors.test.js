import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyFailure, FailureKind } from '../src/errors.js'

test('explicit quota text is classified as quota', () => {
  assert.equal(classifyFailure({ code: 1, stderr: 'You have reached your weekly usage limit' }), FailureKind.QUOTA)
})

test('generic 429 text is not treated as quota', () => {
  assert.equal(classifyFailure({ code: 1, stderr: 'HTTP 429 Too Many Requests' }), FailureKind.UNKNOWN)
})

test('missing provider command is unavailable', () => {
  assert.equal(classifyFailure({ code: 1, spawnError: { code: 'ENOENT' } }), FailureKind.UNAVAILABLE)
})
