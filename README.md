# homeflare-builds

Darwin arm64 builds of software whose vendors ship no macOS binary, published as
**immutable, attested GitHub Releases** for HomeFlare's `ReleaseBinary` to install.

| build                                                        | upstream                                                                 | why it is built here                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------- |
| [`caddy`](builds/caddy/build.ts)                             | Caddy 2.11.4 + caddy-l4, caddy-dns/cloudflare, caddy-jwt, caddy-security | Caddy ships darwin builds, but not with plugins |
| [`cloudflare-exporter`](builds/cloudflare-exporter/build.ts) | lablabs/cloudflare-exporter at `763e5d79` (nixpkgs' "0.3.0")             | upstream publishes Linux container images only  |

Both replace Nix builds on the Mac mini that link `/nix/store/…-libresolv`. These link only
the operating system, and the release job refuses a binary that does not.

## What a release contains

Tag `<name>-v<version>-r<revision>`, two assets:

- `<name>-darwin-arm64-v<version>-r<revision>.tar.gz` — the binary (0755) and its upstream
  `LICENSE` (0644), root-level regular files only, owner 0:0, dated to the upstream source.
- `SHA256SUMS` — `sha256sum` text format: the archive on line 1, then each member.

Every line of `SHA256SUMS` is also an **artifact attestation** subject (SLSA build
provenance, signed through Sigstore by this repository's `release` workflow), and the
release itself is **immutable**: its tag cannot move and its assets cannot be replaced.

```sh
gh release verify caddy-v2.11.4-r1 --repo taslabs-net/homeflare-builds
gh attestation verify caddy-darwin-arm64-v2.11.4-r1.tar.gz --repo taslabs-net/homeflare-builds
gh attestation verify ./caddy --repo taslabs-net/homeflare-builds   # the extracted binary too
```

More in [docs/verifying.md](docs/verifying.md).

## How it works

- [docs/releasing.md](docs/releasing.md) — a pull request that bumps a manifest is a release:
  CI verifies every pin, the merge publishes. No tag is pushed by hand.
- [docs/caddy.md](docs/caddy.md) and [docs/cloudflare-exporter.md](docs/cloudflare-exporter.md)
  — what was measured, on the mini and upstream, to decide exactly what to build.
- [docs/repository.md](docs/repository.md) — why this repository is public, why it never uses
  the mini's runner, and the settings Alchemy does not model.
- [docs/release-binary.md](docs/release-binary.md) — the catalog entries for the kit's
  `ReleaseBinary`.

## Licence

The build scripts are MIT ([LICENSE](LICENSE)). Each binary keeps its upstream licence
(Apache-2.0 for both today), shipped inside its archive.
