# fm-co design

## Basic design

`fm-co` is a thin router in front of coding-agent CLIs and LLOMA. It does not replace Codex, Claude Code, or Grok Build. It selects a provider, runs it, and only advances to the next cloud provider when the previous provider explicitly reports a usage/quota exhaustion condition.

The default chain is `codex -> claude -> grok -> lloma -> fm`. LocalJev can reorder LLOMA to the front for text-only work so that simple explanation, rewrite, summarization, and lightweight reasoning do not consume cloud-agent quota.

Components:

- CLI parser: validates provider order and flags.
- Jev router: calls LocalJev `POST /v1/systemone` and optionally LLOMA `ollama/jwenv:1.7b` as a fallback classifier.
- Provider adapters: Codex, Claude Code, Grok Build, LLOMA, and a custom FM command.
- Failure classifier: distinguishes explicit quota exhaustion from auth/network/unknown failures.
- Git workspace guard: fingerprints the working tree before and after an agent attempt.

## Detailed design

### Jev routing

LocalJev receives at most the first 4096 characters of the user prompt. Repository files, environment variables, credentials, and command output are not attached. The System One question has only two choices:

- `local_text`: no repository inspection, file mutation, command execution, test run, external tool, deployment, or other side effect is required.
- `agentic_code`: any of those capabilities is required.

Only a `local_text` result with confidence >= 0.65 may move LLOMA to the front of the provider chain. A Jev timeout, malformed response, or unavailability leaves the configured provider order unchanged.

Resolution order:

1. LocalJev via `FM_CO_JEV_URL`.
2. LLOMA OpenAI-compatible API using `ollama/jwenv:1.7b`, when an LLOMA token is available.
3. No routing optimization.

### LLOMA

Credentials are loaded from `LLOMA_API_KEY`, or from the default profile in `~/.config/lloma/config.toml`. The default endpoint is `https://lloma.n-n.tokyo/api/openai/v1`. The default generation model is `ollama/qwen2.5-coder:14b`, overridable with `FM_CO_LLOMA_MODEL`.

### Quota fallback

A non-zero provider exit does not imply fallback. Automatic fallback is allowed only when stderr/stdout contains an explicit quota or plan-usage exhaustion signal such as `insufficient_quota`, `quota exceeded`, or `usage limit reached`.

A generic HTTP 429 is not sufficient, because temporary rate limiting is not equivalent to an exhausted plan or token budget. Authentication failures, network failures, timeouts, permission errors, and unknown failures stop the chain.

A missing CLI executable is treated as `unavailable` and may be skipped when another provider is configured.

### Side-effect guard

Before and after each command-based provider, `fm-co` fingerprints Git status plus tracked/staged diffs. If the provider reports quota exhaustion but the fingerprint changed, automatic fallback stops. This reduces duplicate edits or repeated commands when an agent reaches its limit after partially completing work.

This cannot prove that no external side effect occurred. Network calls, deployments, issue creation, database writes, or changes outside the current Git working tree are not fully observable. Agent prompts that can perform such actions should use a single provider or require explicit human continuation after failure.

### Process safety

All provider commands use `cross-spawn` with `shell: false`. User prompts are passed as an argv element for Codex/Claude/Grok and via stdin for FM. Additional provider arguments must be valid JSON string arrays. No command string is evaluated by a shell.

The router never adds flags that bypass provider permission or sandbox controls.
