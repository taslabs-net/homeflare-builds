# Agent guidelines — homeflare-builds

Builds darwin/arm64 binaries no vendor ships and publishes them as immutable, attested
GitHub Releases. **Public repository.**

⛔ **GitHub-hosted runners only — never `[self-hosted, homeflare-mini]`.** Any fork can open a
pull request here; on a self-hosted runner that code would run on the mini's LAN. `repo-shape.ts`
sets `runner: 'github'` and a test pins it; the mini's daemon refuses public repositories on
its side too (homeflare-mini `src/ci-runner/startup.ts`, `start.ts`).

⛔ **Never deploy.** `bun run plan` is fine; `bun run deploy` (the repository's own settings and
`main` ruleset, via `declareRepoPolicy`) is Tim's.

⛔ **A release is immutable.** Never try to replace an asset or move a tag — GitHub refuses, and
the name cannot be reused even after deleting the release. A rebuild is a `revision` bump.

★ **Pins are measured, never guessed.** Every version, commit and digest in `builds/` and
`toolchain/` says where it was read and when. A new one is walked down the same way: see
[docs/releasing.md](docs/releasing.md).

## Toolchain

`bun run check` is the gate — oxfmt + oxlint, `tsc`, `bun test`. It is local-only (no network).
`bun run builds:verify` is the network half (pinned Go, xcaddy regeneration, upstream clone,
cross-build) and runs as the `go builds` CI job.

| concern                              | tool                  | via                                                 |
| ------------------------------------ | --------------------- | --------------------------------------------------- |
| install / run / test                 | `bun` 1.4.0           | —                                                   |
| format, lint, types                  | oxfmt, oxlint, tsc    | `@homeflare/config` presets                         |
| workflows (ci, security, dependabot) | rendered              | `repo-shape.ts` → `bun run repo-shape:refresh`      |
| Go                                   | 1.26.8, sha256-pinned | `toolchain/go.ts`, installed by `scripts/lib/go.ts` |
| Caddy module                         | xcaddy v0.4.7         | `bun run caddy:regenerate`, committed               |

## House rules

- **File length: code ≤250 lines, documents ≤200.** Extract, never compress the reasoning.
- **Comments are the product.** `⛔` a rule and what breaks · `⚠️` a trap and its symptom ·
  `★` why this over the obvious alternative.
- **No secret values, ever.** This repository is public, and so are its Actions logs.
- Commits end `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
