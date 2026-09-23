# Catalog entries for the kit's ReleaseBinary

**Status:** waiting on the kit · **Verified:** 2026-09-22

`ReleaseBinary` — the generalisation of `Victoria.Binary` (homeflare-kit PR 138) — had **not**
landed on kit main when these releases were cut, so nothing here edits the kit. This page
holds the entries for whoever adds them, in the shape PR 138's catalog pins (`PinnedArchive`:
`url`, `size`, `sha256`, `members`, `checksums { url, sha256, recorded }`).

## Getting an entry

```sh
bun run catalog caddy
bun run catalog cloudflare-exporter
```

`scripts/catalog.ts` reads the **published** release, and refuses unless:

1. `SHA256SUMS` parses strictly, and line 1 names the archive;
2. GitHub's own asset `digest` equals that line, for the archive and for `SHA256SUMS` itself;
3. the release is `immutable`.

That is the chain the kit's catalog test proves for Victoria (fixture bytes → GitHub digest →
strict parser → catalog), run against this repository's releases.

## What differs from the Victoria archives

|               | VictoriaMetrics                     | here                                                                        |
| ------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| member names  | `<binary>-prod`, renamed on install | the installed name itself (`caddy`, `cloudflare-exporter`)                  |
| other members | none                                | `LICENSE` (the upstream Apache-2.0 text) — listed, never installed          |
| checksum file | `<asset>_checksums.txt` per archive | `SHA256SUMS` per release (one archive per release)                          |
| release       | mutable (`"immutable": false`)      | **immutable** — tag and assets locked                                       |
| provenance    | none published                      | SLSA attestation for the archive, the binary and `LICENSE`                  |
| version key   | upstream version                    | upstream version **and** revision (`2.11.4-r1`): a rebuild is a new release |

★ **Worth adding to ReleaseBinary for these:** verify the attestation, not only the pinned
digest. The pin proves the bytes are the reviewed ones; the attestation proves this
repository's `release` workflow built them from a named commit. `gh attestation verify
<file> --repo taslabs-net/homeflare-builds` is the reference check.

## The entries

A release's entry exists only once it is published, so each is recorded by the pull request
after its release, from `bun run catalog <name>` output.
