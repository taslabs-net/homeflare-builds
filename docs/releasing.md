# Releasing

**Status:** in use · **Verified:** 2026-09-22

A release is a merged pull request. Nobody pushes a tag.

## The flow

1. A pull request changes a manifest in `builds/<name>/build.ts` — a version, a plugin, a
   flag, the Go pin — and bumps `revision` (or resets it to 1 for a new upstream version).
2. On the pull request:
   - `ci` → `go builds` (ubuntu-latest) installs the pinned Go, regenerates the Caddy module
     with the pinned xcaddy and fails on any difference from the committed one, clones each
     upstream at its pinned commit, cross-builds both binaries and checks their build info.
     If a release already exists for a manifest's tag, the fresh build must reproduce its
     published digests byte for byte.
   - `release` → `build` (macos-26, arm64) builds each binary natively, smoke-tests it, packs
     it. Nothing is published from a pull request.
3. After the merge, `release` on main plans every manifest whose tag has **no published
   release**, builds it again on macos-26, and `publish`:
   - re-verifies the files the build job handed over (`scripts/check-dist.ts`);
   - attests every line of `SHA256SUMS` (`actions/attest`, SLSA provenance);
   - creates the release as a draft, uploads, then publishes — the order immutable releases
     require;
   - downloads it again and runs `gh release verify`, `gh release verify-asset` and
     `gh attestation verify`, as a consumer would.

⚠️ `release` on main runs only when an input path changed (`builds/`, `toolchain/`,
`scripts/`, `package.json`, `bun.lock`, the workflow). A failed publish is retried with
**Run workflow** (workflow_dispatch) — the plan skips anything already released.

## Bumping Caddy or a plugin

1. Read the new version from the vendor (its release page or `go list -m -versions`).
2. Change it in `builds/caddy/build.ts` and bump `revision`.
3. `bun run caddy:regenerate` — commits go.mod, go.sum and main.go exactly as the pinned
   xcaddy writes them. Review the go.mod diff: it is every transitive version that moved.
4. If the plugin set changed, re-measure `builds/caddy/modules.txt` from a build you trust
   (`caddy list-modules --versions --skip-standard`, module lines only).
5. Update `sourceDate` and `licenseSha256` if Caddy itself moved.

## Bumping Go

Read `https://go.dev/dl/?mode=json&include=all`; copy `filename`, `sha256` and `size` for
every host in `toolchain/go.ts`. Then bump `revision` on **every** build — the binary changes.

## Bumping the exporter

Pin the new **commit**, not just the tag, and re-measure `goModSha256`, `goSumSha256` and
`licenseSha256` from a clone at that commit. ⚠️ Upstream's `cloudflare-exporter-X` tags are
Helm chart releases and its app tags have no prefix — see docs/cloudflare-exporter.md.

## When a publish fails half-way

- A **draft** for the tag exists: the publish job stops rather than publish beside it. Read the
  draft, delete it by hand, re-run.
- A **tag** exists with no release: `plan` stops. With immutable releases a tag name that was
  ever released can never be reused, so bump `revision` and say why in the pull request.
