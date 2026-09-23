# Verifying a download

**Status:** in use · **Verified:** 2026-09-22

Four independent checks, from weakest to strongest. A host should do 2 and 3; anyone can do 4.

## 1. The checksum file — integrity

```sh
shasum -a 256 --check --ignore-missing SHA256SUMS
```

`SHA256SUMS` lists the archive, then each member (`caddy` or `cloudflare-exporter`, and
`LICENSE`). `--ignore-missing` because the members are inside the archive. On its own this
proves only that the download matches a file published beside it.

## 2. The release — it has not changed

```sh
gh release verify <tag> --repo taslabs-net/homeflare-builds
gh release verify-asset <tag> <archive> --repo taslabs-net/homeflare-builds
```

Releases here are **immutable** (repository setting, enabled 2026-09-22): the tag cannot move
and no asset can be replaced or deleted, and GitHub signs a release attestation when it is
published. This closes the gap VictoriaMetrics' mutable releases leave open (the kit's
Victoria catalog comment): whoever can swap an archive cannot also swap its checksum file.

## 3. The build — who made it, from what

```sh
gh attestation verify <archive> --repo taslabs-net/homeflare-builds
gh attestation verify ./caddy --repo taslabs-net/homeflare-builds
```

A SLSA build-provenance attestation, signed through Sigstore's public-good instance with the
`release` workflow's OIDC identity, names this repository, the workflow file, the commit and
the run. Every line of `SHA256SUMS` is a subject, so the **extracted binary on disk** verifies
too — the check a host can run on the file it actually executes.

★ To pin the signer as well as the repository:

```sh
gh attestation verify ./caddy --repo taslabs-net/homeflare-builds \
  --signer-workflow taslabs-net/homeflare-builds/.github/workflows/release.yml
```

## 4. Rebuild it — the build is reproducible

Measured on PR 1 (2026-09-22): the Linux cross-build in the `go builds` job and the native
macOS build in `release` produced the **same bytes** — `caddy` `2e350f6f…fbe38` and its archive
`f1f6922c…21c42b` from both runners. Nothing in the build depends on the host: Go with cgo off,
`-trimpath`, no build ID, no VCS stamp for the generated module, and an archive written byte by
byte with fixed owner and the source's date. So anyone can check a release without trusting
this repository's runner at all:

```sh
bun install && bun run builds:verify   # any Linux or macOS host with bun
```

It rebuilds every manifest and, for each tag already released, fails unless the published
`SHA256SUMS` lines come out identical.

## The binary's own record

```sh
go version -m ./caddy
```

Every Go binary carries its toolchain, build flags and each module version. The release notes
repeat it; the binary is the authority.
