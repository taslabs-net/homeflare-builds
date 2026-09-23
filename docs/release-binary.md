# Data-set entries for the kit's Release.Binary

**Status:** waiting on the kit · **Verified:** 2026-09-22

The kit's `Release.Binary` (homeflare-kit PR 138, which generalised `Victoria.Binary`) had
**not** landed on kit main when these releases were cut, so nothing here edits the kit. This
page holds the entries for whoever adds a `homeflare-builds` data set beside `victoria.ts`, in
the shape PR 138 pins (`CatalogPackage` → `PinnedArchive`).

## Measured compatibility with the kit's own readers

On 2026-09-22 the two published archives were fed to PR 138's `src/release/tar.ts`
(`tarReader`) and `src/release/checksums.ts` (`parseChecksums`), copied read-only from its head
(`fdb1b4f`): both parse, both archives hold exactly `<binary>` and `LICENSE` as root-level
regular files, and every member's SHA-256 matches its `SHA256SUMS` line.

The kit's walk-down for a new vendor (its docs/release-binary-catalogs.md) asks two things:

- **checksum format, byte-exact** — `sha256sum` text mode, the archive then every member: the
  same measured shape Victoria's files have, so no new parser field is needed;
- **linkage** — `otool -L` on both extracted members: `/usr/lib/libSystem.B.dylib`,
  `/usr/lib/libresolv.9.dylib`, CoreFoundation, Security. The same set as the Victoria
  binaries; nothing from `/nix/store` or `/opt/homebrew`.

## The entries

`bun run catalog caddy` and `bun run catalog cloudflare-exporter`, run against the published
releases (the script refuses unless GitHub's digests, `SHA256SUMS`, the strict tar read and
`immutable: true` all agree):

```ts
export const HOMEFLARE_BUILDS_RELEASES: ReleaseCatalog = {
  vendor: 'homeflare-builds',
  packages: {
    // caddy-v2.11.4-r1: immutable release; SLSA attestation over every SHA256SUMS line.
    caddy: {
      binaries: { caddy: 'caddy' },
      versions: {
        '2.11.4-r1': {
          'darwin-arm64': {
            asset: 'caddy-darwin-arm64-v2.11.4-r1.tar.gz',
            checksums: {
              recorded: '2026-09-22',
              sha256: '25abe895733729451ea34a081a7aac9589111846950edc2dc47ca5d734c83bef',
              url: 'https://github.com/taslabs-net/homeflare-builds/releases/download/caddy-v2.11.4-r1/SHA256SUMS',
            },
            members: {
              caddy: '2e350f6f6576a5c998c9b174fadedcf0917e4389488ee1b4dbb5bdfc9aafbe38',
              LICENSE: 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30',
            },
            repo: 'taslabs-net/homeflare-builds',
            sha256: 'f1f6922cb7943e0716c83cc182e3ff688221455175239df60b2254028b21c42b',
            size: 24_078_543,
            tag: 'caddy-v2.11.4-r1',
          },
        },
      },
    },
    // cloudflare-exporter-v0.3.0-r1: immutable release; SLSA attestation over every line.
    'cloudflare-exporter': {
      binaries: { 'cloudflare-exporter': 'cloudflare-exporter' },
      versions: {
        '0.3.0-r1': {
          'darwin-arm64': {
            asset: 'cloudflare-exporter-darwin-arm64-v0.3.0-r1.tar.gz',
            checksums: {
              recorded: '2026-09-22',
              sha256: 'dc4071ab08124e3e11c96a01ef41c9b3867a9dbb83ad6f40f3fda9ccbad88632',
              url: 'https://github.com/taslabs-net/homeflare-builds/releases/download/cloudflare-exporter-v0.3.0-r1/SHA256SUMS',
            },
            members: {
              'cloudflare-exporter':
                '3beb6c2a82fdc4c4fb3a8ff82a7747ce50643367ce9adc0a4e8a047b8c2b5af9',
              LICENSE: '5baa859f70aa8559ce0db45ec507bfaefa6318b63154aac09e87c41b63e9282d',
            },
            repo: 'taslabs-net/homeflare-builds',
            sha256: 'b330db742d72121e6db9b2e6003550cef613d58fb644334fde63313f9f9e5ed8',
            size: 5_962_161,
            tag: 'cloudflare-exporter-v0.3.0-r1',
          },
        },
      },
    },
  },
};
```

The two `SHA256SUMS` files are the fixtures the kit's data-set test would commit
(`src/release/fixtures/homeflare-builds/`), byte for byte from the release.

## What differs from the Victoria archives

|               | VictoriaMetrics                     | here                                                              |
| ------------- | ----------------------------------- | ----------------------------------------------------------------- |
| member names  | `<binary>-prod`, renamed on install | the installed name itself                                         |
| other members | none                                | `LICENSE` (upstream Apache-2.0 text): listed, never installed     |
| checksum file | `<asset>_checksums.txt`             | `SHA256SUMS`, one archive per release                             |
| release       | mutable (`"immutable": false`)      | **immutable**: tag and assets locked                              |
| provenance    | none published                      | SLSA attestation for archive, binary and `LICENSE`                |
| version key   | upstream version                    | upstream version **and** revision (`2.11.4-r1`): a rebuild is new |
| rebuildable   | no                                  | yes: `bun run builds:verify` reproduces the published digests     |

★ **Worth adding to Release.Binary for these:** verify the attestation, not only the pinned
digest. The pin proves the bytes are the reviewed ones; the attestation proves this
repository's `release` workflow built them from a named commit
(`gh attestation verify <file> --repo taslabs-net/homeflare-builds` is the reference). Victoria
publishes none, which is why PR 138 records the attestations API answering 404 for it.
