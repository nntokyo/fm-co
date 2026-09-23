import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeReleaseTag, verifyReleaseVersion } from '../scripts/verify-release-version.mjs'

test('release tag vX.Y.Z matches package version X.Y.Z', () => {
  assert.equal(verifyReleaseVersion('v0.1.0', '0.1.0'), '0.1.0')
})

test('release tag without v prefix is also normalized', () => {
  assert.equal(normalizeReleaseTag('0.1.0'), '0.1.0')
})

test('mismatched release tag is rejected', () => {
  assert.throws(
    () => verifyReleaseVersion('v0.2.0', '0.1.0'),
    /does not match package version/,
  )
})

test('empty release tag is rejected', () => {
  assert.throws(() => normalizeReleaseTag(''), /release tag is required/)
})

test('prerelease versions are rejected to avoid publishing them as latest', () => {
  assert.throws(
    () => verifyReleaseVersion('v0.2.0-beta.1', '0.2.0-beta.1'),
    /only stable X.Y.Z releases are supported/,
  )
})
