# cloudflare-exporter — what was measured

**Status:** pinned in `builds/cloudflare-exporter/build.ts` · **Verified:** 2026-09-22

## The running binary (the mini, read-only)

Two launchd jobs run `/nix/store/09sya0bzwn5nl1v0xmn09kg0qpyi0isf-cloudflare-exporter-0.3.0/bin/cloudflare-exporter`
(`--listen 127.0.0.1:9198` and `:9199`, `--scrape_interval 300`).

| read                 | result                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `go version -m`      | `go1.26.7`, path `github.com/lablabs/cloudflare-exporter`, `CGO_ENABLED=1`, `-trimpath=true` |
| derivation `ldflags` | `-buildid=`                                                                                  |
| derivation source    | nixpkgs `fetchFromGitHub { owner = "lablabs"; tag = "cloudflare-exporter-0.3.0"; }`          |
| `otool -L`           | libSystem, `/usr/lib/libresolv.9.dylib`, CoreFoundation, Security                            |

A fresh clone of that tag is **byte-identical** to the store source (`diff -r`, `.git`
excluded). The tag resolves to commit `763e5d79f50ed5ce4088c12b9c03a532bad3220c`
(2025-11-08, "Add sleep to e2e tests execution").

## ⚠️ "0.3.0" is not an app release

Upstream publishes two tag series in one repository:

| tag form                | what it is                                                                      | assets              |
| ----------------------- | ------------------------------------------------------------------------------- | ------------------- |
| `0.2.3` (no prefix)     | the app — `docker-release.yaml` builds linux/amd64 + linux/arm64 images with ko | none on the release |
| `cloudflare-exporter-X` | Helm chart releases (chart-releaser)                                            | the chart `.tgz`    |

`cloudflare-exporter-0.3.0` has **no assets**, and `charts/cloudflare-exporter/Chart.yaml` at
its commit still says `version: 0.2.2`, `appVersion: 0.0.16` — it is a release made by hand on
master, 57 commits after app `0.2.3`. nixpkgs packages it as version 0.3.0, so that is the
name the mini's store path carries. This repository keeps the name (it is what the estate
calls the thing it runs) and pins the **commit**, which is what actually decides the bytes.

## Why nixpkgs says Linux only, and whether darwin needs its own build

nixpkgs' `pkgs/by-name/pr/prometheus-cloudflare-exporter/package.nix` sets
`platforms = lib.platforms.linux`. Nothing in the source is Linux-specific: it is a pure-Go
cobra/viper program with no cgo and no build tags, and the running binary measured above —
the mini's own aarch64-darwin build, serving live jobs today — is the proof. **No darwin
patch is needed** — only a build, because upstream ships no binary for any platform:

- the releases carry no assets (checked for every tag);
- `.github/workflows/go-build.yml` would cross-build linux/amd64, darwin/amd64 and linux/arm64
  on release creation (no darwin/arm64), and attached nothing to 0.3.0.

## What this build does differently

| input   | Nix build      | here              | why                                                                                   |
| ------- | -------------- | ----------------- | ------------------------------------------------------------------------------------- |
| Go      | 1.26.7         | 1.26.8            | the repository's one Go pin (toolchain/go.ts)                                         |
| cgo     | on             | **off**           | pure Go; drops libresolv                                                              |
| ldflags | `-buildid=`    | `-s -w -buildid=` | upstream's Makefile strips symbols too                                                |
| VCS     | none (tarball) | `-buildvcs=true`  | the binary records the upstream commit, and the build refuses one that is not the pin |

There is no `--version`; the smoke test runs `--help` and requires the two flags the launchd
jobs pass.
