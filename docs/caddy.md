# Caddy — what was measured

**Status:** pinned in `builds/caddy/build.ts` · **Verified:** 2026-09-22

## The running binary (the mini, read-only)

The edge Caddy runs as root from
`/nix/store/0l76bnd9v7qlj2g2jbbhk45dm8c0gs1n-caddy-2.11.4/bin/caddy`.

| command                                         | result                                                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `caddy version`                                 | `2.11.4 v2.11.4`                                                                                                |
| `caddy build-info` (toolchain)                  | `go1.26.7`, `-trimpath=true`, `CGO_ENABLED=1`, `GOARM64=v8.0`                                                   |
| `caddy build-info` (tags)                       | `-tags=nobadger,nomysql,nopgx`                                                                                  |
| `caddy build-info` (non-standard deps)          | caddy-dns/cloudflare v0.2.4 · ggicci/caddy-jwt v1.4.0 · greenpau/caddy-security v1.1.64 · mholt/caddy-l4 v0.1.2 |
| `caddy list-modules --versions --skip-standard` | 48 modules → `builds/caddy/modules.txt`                                                                         |
| `otool -L`                                      | `/nix/store/…-libresolv-96/lib/libresolv.9.dylib`, CoreFoundation, Security, libSystem                          |
| `codesign -dv`                                  | ad hoc, linker-signed                                                                                           |

The leading `2.11.4` in `caddy version` is nixpkgs' `-X …CustomVersion=2.11.4` ldflag. Caddy's
own releases do not set it, and neither does this build: `caddy version` prints the module
version from build info (`v2.11.4 h1:…`).

## The Nix module that builds it

House monorepo, `house/nix/homeflare-config/hosts/macmini/modules/edge.nix`:
`pkgs.caddy.withPlugins { plugins = [ caddy-l4@v0.1.2, caddy-dns/cloudflare@v0.2.4,
caddy-jwt@v1.4.0, caddy-security@v1.1.64 ]; }`. Its derivations (`nix derivation show`):

- the source step runs `XCADDY_SKIP_BUILD=1 xcaddy build v2.11.4 --with …` (xcaddy 0.4.6,
  go 1.26.7, plugins in alphabetical order) and vendors the result;
- the build step: `-ldflags "-s -w -X …CustomVersion=2.11.4 -buildid="`, tags as above,
  `GOFLAGS=-mod=vendor -trimpath`, `CGO_ENABLED=1`.

## What this build does differently, and why

| input   | Nix build        | here             | why                                                                     |
| ------- | ---------------- | ---------------- | ----------------------------------------------------------------------- |
| Go      | 1.26.7           | 1.26.8           | newest patch on the line Caddy 2.11.4 was released with (`~1.26.0`)     |
| xcaddy  | v0.4.6           | v0.4.7           | newest release; generates the same module (compared below)              |
| cgo     | on (Nix default) | **off**          | Caddy's own releases are cgo-free; this is what drops the Nix libresolv |
| version | `CustomVersion`  | build info       | as Caddy's own releases                                                 |
| deps    | vendored         | committed go.sum | the same graph, reviewable, and `-mod=readonly` refuses a mismatch      |

The plugin versions, the three build tags, `-trimpath` and `-s -w -buildid=` are unchanged.

## The generated module, compared

`builds/caddy/{go.mod,go.sum,main.go}` is what xcaddy v0.4.7 writes for the manifest. Against
the Nix store's `caddy-src-with-plugins-…-2.11.4` (xcaddy v0.4.6): see the comparison recorded
in the pull request that added this file; the `go` directive differs by construction (xcaddy
writes the version of the Go that ran it).

## Why these four plugins

From the comments in edge.nix: layer4 terminates IMAPS; cloudflare DNS answers ACME DNS-01 for
wildcard certificates; caddy-jwt verifies Cloudflare Access JWTs at the edge; caddy-security
runs an OIDC relying party for surfaces that cannot log in by themselves.
