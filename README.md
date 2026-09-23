# fm-co

Token-aware multi-provider CLI for **Codex, Claude Code, Grok Build, LLOMA, and FM**.

`fm-co` keeps coding work moving when a provider reaches an explicit usage/quota limit. It can also use the LLOMA project's **LocalJev / System One** classifier to send simple text-only work to a local model first, reducing cloud-agent token consumption.

## Status

Initial CLI implementation. Automatic fallback is intentionally conservative: authentication errors, network failures, timeouts, generic rate limits, and unknown failures do **not** cause a prompt to be sent to another cloud provider.

## Install

From GitHub:

```bash
npm install -g github:nntokyo/fm-co
```

After the one-time npm Registry bootstrap release:

```bash
npm install -g fm-co
```

Requires Node.js 24 or later.

Provider CLIs are installed separately so they can follow each vendor's current supported installer and update cadence:

```bash
# Codex
curl -fsSL https://chatgpt.com/codex/install.sh | sh

# Grok Build
curl -fsSL https://x.ai/cli/install.sh | bash

# Claude Code
# Use Anthropic's current native installer documented for Claude Code.
```

Then authenticate each provider normally (`codex`, `claude`, `grok`). `fm-co` reuses their existing login state.

## Quick start

```bash
fm-co "Fix the failing tests and update the implementation"
```

Default provider order:

```text
codex -> claude -> grok -> lloma -> fm
```

Choose the chain explicitly:

```bash
fm-co --providers codex,claude,grok "Implement issue #42"
fm-co --providers grok,codex "Review this repository"
fm-co --provider lloma "Explain the difference between a mutex and semaphore"
```

If Codex reaches an explicit usage limit before changing the Git workspace, `fm-co` can continue with Claude, then Grok. If a provider modifies the Git workspace before failing, automatic fallback stops to reduce duplicate side effects.

## Jev: reduce cloud token use

The LLOMA repository runs LocalJev with the TypeSafe System One API and `jwenv:1.7b`. Configure it with:

```bash
export FM_CO_JEV_URL="http://gpu-host:8080"
```

`fm-co` sends only the first 4096 characters of the prompt to `POST /v1/systemone`. Jev chooses only between:

- `local_text`: text-only work with no repository inspection, file changes, commands, tests, tools, or side effects.
- `agentic_code`: work that needs an agentic coding environment.

For `local_text`, LLOMA is moved to the front when LLOMA credentials exist. For `agentic_code`, the requested cloud-agent order is kept.

Disable Jev per command:

```bash
fm-co --no-jev "Fix this repository"
```

Inspect the decision without running a provider:

```bash
fm-co --dry-run "Explain this error message"
```

If LocalJev is unreachable, `fm-co` can use LLOMA's `ollama/jwenv:1.7b` as the lightweight classifier. If that is also unavailable, routing fails open to the configured provider order rather than blocking work.

## LLOMA configuration

`fm-co` uses the OpenAI-compatible endpoint already provided by `lloma.n-n.tokyo`.

Authentication priority:

1. `LLOMA_API_KEY`
2. the `default` profile token in `~/.config/lloma/config.toml`

Defaults:

```text
endpoint: https://lloma.n-n.tokyo/api/openai/v1
model:    ollama/qwen2.5-coder:14b
```

Overrides:

```bash
export FM_CO_LLOMA_ENDPOINT="https://lloma.n-n.tokyo/api/openai/v1"
export FM_CO_LLOMA_MODEL="ollama/qwen2.5-coder:14b"
```

The existing LLOMA CLI can create the saved token:

```bash
lloma login
```

## Custom FM command

Configure any command as the final FM provider. The prompt is written to stdin; it is not interpolated into a shell command.

```bash
export FM_CO_FM_COMMAND="my-fm-chat"
export FM_CO_FM_ARGS_JSON='["--mode","chat"]'

fm-co --providers codex,fm "Review this patch"
```

## Provider overrides

Commands can be replaced without changing source:

```bash
export FM_CO_CODEX_COMMAND="codex"
export FM_CO_CLAUDE_COMMAND="claude"
export FM_CO_GROK_COMMAND="grok"
```

Additional arguments must be JSON string arrays:

```bash
export FM_CO_CODEX_ARGS_JSON='["--model","gpt-5.6-codex"]'
export FM_CO_CLAUDE_ARGS_JSON='[]'
export FM_CO_GROK_ARGS_JSON='[]'
```

`fm-co` does not add flags that disable sandboxing or bypass approval controls.

## Fallback policy

Automatic transition to the next cloud provider requires an explicit quota/usage exhaustion signal. A generic `429 Too Many Requests` alone does not qualify.

The chain stops on authentication failures, network failures, timeouts, permission errors, invalid requests, unknown failures, or when the Git workspace changed during the failed attempt.

A provider executable that is not installed is treated as unavailable and can be skipped when more providers remain.

## CLI

```text
fm-co [options] <prompt...>

--providers LIST   comma-separated chain
--provider NAME    exactly one provider
--jev              enable Jev routing (default)
--no-jev           disable Jev routing
--dry-run          show routing only
--timeout MS       per-provider timeout; 0 = disabled
--help
--version
```

## Development

```bash
npm install
npm test
npm run pack:check
```

Design details are in [`docs/DESIGN.md`](docs/DESIGN.md).

## Publishing

The repository includes an npm Trusted Publishing workflow for releases after the initial Registry bootstrap.

The one-time bootstrap is intentionally interactive:

```bash
npm view fm-co version
npm install --ignore-scripts
npm test
npm pack --dry-run
npm login
npm publish --access public
```

After `fm-co` exists on npmjs.com, configure its Trusted Publisher for:

```text
GitHub user/org: nntokyo
Repository:      fm-co
Workflow file:   publish.yml
Allowed action:  npm publish
```

For later versions, update `package.json` in a PR and publish a GitHub Release tagged exactly `v<version>`. The release workflow rejects a tag/version mismatch, runs tests and package inspection, then publishes with GitHub OIDC. No long-lived npm publish token is required.

See [`docs/RELEASING.md`](docs/RELEASING.md) for the complete release procedure.

## Security notes

- Provider processes run with `shell: false`.
- Secrets are never intentionally printed.
- Jev receives only a bounded prompt fragment, not repository files or environment variables.
- Generic failures do not automatically resend the prompt to another cloud provider.
- Git fingerprinting reduces duplicate file edits but cannot detect every external side effect.
- Provider CLIs remain separately installed so security/compatibility updates can be applied independently.
- npm release automation uses OIDC Trusted Publishing and does not store a long-lived publish token.

## Roadmap

- [x] npm-installable CLI package
- [x] Codex / Claude / Grok / LLOMA / FM adapters
- [x] LocalJev System One routing
- [x] LLOMA `jwenv:1.7b` classifier fallback
- [x] conservative quota classification
- [x] Git workspace side-effect guard
- [x] unit tests
- [x] CI test + package dry-run
- [x] npm Trusted Publishing workflow
- [ ] one-time npm Registry bootstrap release
- [ ] structured provider-specific quota codes where vendor CLIs expose stable machine-readable errors
- [ ] optional telemetry-free token savings report

## License

MIT
