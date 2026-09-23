import { FailureKind } from './errors.js'
import { gitWorkspaceFingerprint } from './git-state.js'

export async function runProviderChain(providers, {
  buildProvider,
  cwd = process.cwd(),
  fingerprint = gitWorkspaceFingerprint,
  onEvent = () => {},
} = {}) {
  if (!providers.length) return { ok: false, kind: FailureKind.INVALID, detail: 'No providers configured' }

  for (let index = 0; index < providers.length; index++) {
    const name = providers[index]
    const provider = buildProvider(name)
    const before = name === 'lloma' ? null : await fingerprint(cwd)
    onEvent({ type: 'provider_start', provider: name, index })
    const result = await provider.run()

    if (result.ok) {
      onEvent({ type: 'provider_success', provider: name, index })
      return { ...result, provider: name }
    }

    const after = name === 'lloma' ? null : await fingerprint(cwd)
    const workspaceChanged = before !== null && after !== null && before !== after
    onEvent({ type: 'provider_failure', provider: name, index, kind: result.kind, workspaceChanged })

    if (result.kind === FailureKind.UNAVAILABLE && index < providers.length - 1) continue
    if (result.kind !== FailureKind.QUOTA) return { ...result, provider: name, workspaceChanged }
    if (workspaceChanged) {
      return {
        ok: false,
        kind: FailureKind.UNKNOWN,
        provider: name,
        workspaceChanged: true,
        detail: `${name} reached a usage limit after the Git workspace changed; automatic fallback was stopped to avoid duplicate side effects.`,
      }
    }
    if (index === providers.length - 1) return { ...result, provider: name, workspaceChanged }
    onEvent({ type: 'fallback', from: name, to: providers[index + 1] })
  }

  return { ok: false, kind: FailureKind.UNKNOWN, detail: 'Provider chain ended unexpectedly' }
}
