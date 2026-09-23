import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function normalizeReleaseTag(tag) {
  if (typeof tag !== 'string' || !tag.trim()) {
    throw new Error('release tag is required')
  }
  const trimmed = tag.trim()
  return trimmed.startsWith('v') ? trimmed.slice(1) : trimmed
}

export function verifyReleaseVersion(tag, version) {
  const normalized = normalizeReleaseTag(tag)
  if (normalized !== version) {
    throw new Error(`release tag ${tag} does not match package version ${version}`)
  }
  return normalized
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const root = path.resolve(here, '..')
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
  const tag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME
  verifyReleaseVersion(tag, pkg.version)
  process.stdout.write(`release version verified: ${pkg.version}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`release verification failed: ${error.message}\n`)
    process.exitCode = 1
  })
}
