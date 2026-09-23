# The repository itself

**Status:** in use · **Verified:** 2026-09-22

## Public, on purpose

Tim approved a **public** repository named `homeflare-builds` (2026-09-23): `ReleaseBinary`
installs from a release download URL, and a public release needs no credential on the host.
Nothing here is secret — pins, scripts and workflows are all meant to be read.

## ⛔ GitHub-hosted runners only

Any GitHub user can fork a public repository and open a pull request. A workflow that runs on
a **self-hosted** runner would run that fork's code on the machine behind the runner — for the
mini, on the house LAN. So:

- every job here is `ubuntu-latest` or `macos-26` (GitHub-hosted, free for public repositories);
- `repo-shape.ts` sets `runner: 'github'`, and `tests/repo-shape.test.ts` fails if it changes;
- fork pull requests from **first-time contributors** need approval before any workflow runs
  (the kit's setting);
- the mini's CI daemon independently refuses any repository GitHub does not report as
  `private: true` — at start-up, every 10 minutes, and again at the moment of each runner
  registration (homeflare-mini `src/ci-runner/startup.ts`, `main.ts`, `start.ts`; tests in
  `tests/ci-runner/guards.test.ts`). A typo that listed this repository there would stop the
  daemon, not expose the mini.

## Settings

Declared in `alchemy.run.ts` through `declareRepoPolicy` (from `@homeflare/alchemy`), fed by
`renderRepoShape(shape).policy` (from `@homeflare/config`) — so the `main` ruleset requires
exactly the checks the rendered workflows report, `ci` and `secret scan`:

- squash-only merges, auto-merge on, head branches deleted on merge;
- a `main` ruleset over the default branch: no deletion, no force push, `ci` and
  `secret scan` required, no bypass actors.

⛔ **Deploying is Tim's**: `bun run plan`, then `bun run deploy` (`--stage live`). Until the
first deploy there is **no ruleset**, so auto-merge has nothing to wait for; pull requests
before then were merged by hand after every check was green.

⚠️ The ruleset cannot be adopted (alchemy beta.79 creates when it has no state). None was made
by hand — `gh api repos/taslabs-net/homeflare-builds/rulesets` returned `[]` at creation —
so the first deploy makes the only one. Check again before deploying.

### Set by hand at creation, because Alchemy does not model them

Applied with `gh api` on 2026-09-22 and read back the same day. A deploy neither sets nor
resets them.

| setting                                    | value                      | why                                                                 |
| ------------------------------------------ | -------------------------- | ------------------------------------------------------------------- |
| `immutable-releases`                       | enabled                    | tags and assets cannot change once published (docs/verifying.md)    |
| fork-PR contributor approval               | `first_time_contributors`  | the kit's setting; a stranger's first PR runs nothing unapproved    |
| default `GITHUB_TOKEN` permissions         | `read`, cannot approve PRs | every workflow declares its own; nothing inherits `write`           |
| squash commit title / message              | PR title / PR body         | matches the kit                                                     |
| merge methods, auto-merge, delete-on-merge | as the policy declares     | set early so the first pull request behaved; the deploy adopts them |
