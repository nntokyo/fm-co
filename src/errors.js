export const FailureKind = Object.freeze({
  QUOTA: 'quota',
  AUTH: 'auth',
  UNAVAILABLE: 'unavailable',
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  INVALID: 'invalid',
  UPSTREAM: 'upstream',
  UNKNOWN: 'unknown',
})

const quotaPatterns = [
  /\binsufficient_quota\b/i,
  /\bquota[_ -]?exceeded\b/i,
  /\busage limit (?:has been )?(?:reached|exceeded)\b/i,
  /\byou(?:'ve| have) reached (?:your|the) .*?(?:usage|token|plan) limit\b/i,
  /\b(?:weekly|monthly|daily) limit (?:has been )?(?:reached|exceeded)\b/i,
  /\bcredit balance (?:is )?(?:too low|exhausted|depleted)\b/i,
  /\bno (?:more )?credits? remaining\b/i,
  /\bplan limit (?:has been )?(?:reached|exceeded)\b/i,
]

const authPatterns = [
  /\bunauthori[sz]ed\b/i,
  /\bauthentication (?:failed|required)\b/i,
  /\binvalid api key\b/i,
  /\bplease (?:sign in|log in|login)\b/i,
  /\bnot logged in\b/i,
]

export function classifyFailure({ stderr = '', stdout = '', code = 1, signal = null, spawnError = null } = {}) {
  const text = `${stderr}\n${stdout}`.slice(-64_000)
  if (spawnError?.code === 'ENOENT') return FailureKind.UNAVAILABLE
  if (spawnError) return FailureKind.UNKNOWN
  if (signal === 'SIGTERM' || signal === 'SIGKILL') return FailureKind.TIMEOUT
  if (quotaPatterns.some((re) => re.test(text))) return FailureKind.QUOTA
  if (authPatterns.some((re) => re.test(text))) return FailureKind.AUTH
  if (code === 0) return null
  return FailureKind.UNKNOWN
}

export function isQuotaText(text = '') {
  return quotaPatterns.some((re) => re.test(text))
}
