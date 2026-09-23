/**
 * Caddy 2.11.4 with the four plugins the mini's edge runs — no vendor ships this for darwin.
 *
 * ★ MEASURED FROM THE RUNNING BINARY, 2026-09-22 (read-only, on the mini): `caddy version` →
 *   `2.11.4 v2.11.4`; `caddy build-info` → go1.26.7, `-tags=nobadger,nomysql,nopgx`,
 *   `-trimpath=true`, and exactly these four non-standard dependencies at these versions;
 *   `caddy list-modules --versions --skip-standard` → the 48 lines in modules.txt, which the
 *   smoke test requires of every build. The mini's running Caddy is still built by its
 *   nix-darwin system until the Caddy cutover; this pins the same four plugins, built
 *   `xcaddy build v2.11.4 --with …` in this order.
 * ★ WHY THIS EXISTS: the nix-darwin build links `/nix/store/…-libresolv-96/lib/libresolv.9.dylib`
 *   (`otool -L`, measured). This one is built with CGO_ENABLED=0, the way Caddy's own
 *   release is, and links only system libraries — the smoke test refuses anything else.
 * ⛔ THE VERSION IS NOT SET BY LDFLAGS. nixpkgs adds `-X …CustomVersion=2.11.4`, which is
 *   where the leading `2.11.4` in the mini's `caddy version` comes from; Caddy's own releases
 *   do not, and read the version from the module's build info instead. So does this.
 */
import type { XcaddyBuild } from '../types.ts';

export const caddy: XcaddyBuild = {
  kind: 'xcaddy',
  name: 'caddy',
  version: '2.11.4',
  revision: 1,
  // The commit v2.11.4 tags (e2eee6a7…), committed 2026-06-01 (tag object 8ec11a4b…).
  sourceDate: '2026-06-01T19:35:02Z',
  license: 'Apache-2.0',
  // raw.githubusercontent.com/caddyserver/caddy/v2.11.4/LICENSE, measured 2026-09-22; the
  // build reads it out of the module cache (go.sum-verified) and refuses any other digest.
  licenseSha256: 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30',
  moduleDir: 'builds/caddy',
  caddy: { module: 'github.com/caddyserver/caddy/v2', version: 'v2.11.4' },
  // ★ v0.4.7, the newest release (2026-08-17). The Nix build used v0.4.6; the module it
  //   generates is compared in docs/caddy.md, and CI regenerates with this one on every PR.
  xcaddy: { module: 'github.com/caddyserver/xcaddy/cmd/xcaddy', version: 'v0.4.7' },
  plugins: [
    { module: 'github.com/caddy-dns/cloudflare', version: 'v0.2.4' }, // ACME DNS-01
    { module: 'github.com/ggicci/caddy-jwt', version: 'v1.4.0' }, // Access JWT (jwtauth)
    { module: 'github.com/greenpau/caddy-security', version: 'v1.1.64' }, // OIDC at the edge
    { module: 'github.com/mholt/caddy-l4', version: 'v0.1.2' }, // layer4 (IMAPS)
  ],
  modulesFile: 'builds/caddy/modules.txt',
  flags: {
    // ★ The same three tags nixpkgs and Caddy's own release build with: they leave the
    //   badger, MySQL and pgx drivers out of smallstep's nosql, which Caddy never uses.
    tags: ['nobadger', 'nomysql', 'nopgx'],
    ldflags: ['-s', '-w', '-buildid='],
    buildvcs: false,
  },
  smoke: { args: ['version'], expect: ['v2.11.4'] },
};
